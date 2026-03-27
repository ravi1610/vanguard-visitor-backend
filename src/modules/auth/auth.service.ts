import {
  Inject,
  Injectable,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { RbacService } from '../rbac/rbac.service';

/** Reusable Prisma include for loading a user with tenant + roles + permissions */
const USER_WITH_ROLES_INCLUDE = {
  tenant: true,
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
  userPermissions: {
    include: {
      permission: true,
    },
  },
} as const;

/** TTL for JWT active-status cache (5 minutes) */
const JWT_CACHE_TTL = 5 * 60 * 1000;

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private rbac: RbacService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async onModuleInit() {
    // Returns only keys that are brand-new (didn't exist before)
    const newPermKeys = await this.rbac.seedPermissionsIfNeeded();
    // Only grant newly-added keys to existing admin/tenant_owner roles; never restore removed ones
    this.rbac.syncAllTenantsDefaultRoles(newPermKeys).catch((err) => {
      console.error('Background role sync failed:', err);
    });
  }

  /** Map a user record (with nested roles) to a flat auth profile */
  private toAuthProfile(user: {
    id: string;
    email: string;
    tenantId: string;
    firstName: string;
    lastName: string;
    isSuperAdmin: boolean;
    tenant: { name: string } | null;
    userRoles: { role: { key: string; rolePermissions: { permission: { key: string } }[] } }[];
    userPermissions: {
      effect: 'allow' | 'deny';
      permission: { key: string };
    }[];
  }) {
    const roles = user.userRoles.map((ur) => ur.role.key);
    const { effective } = this.rbac.getEffectivePermissions(
      user.userRoles.map((ur) => ur.role),
      user.userPermissions,
    );
    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenant?.name ?? '',
      firstName: user.firstName,
      lastName: user.lastName,
      isSuperAdmin: user.isSuperAdmin,
      roles,
      permissions: effective,
    };
  }

  async validateUser(email: string, password: string) {
    const lookup = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), isActive: true },
      select: {
        id: true,
        tenantId: true,
        passwordHash: true,
        isActive: true,
        tenant: { select: { isActive: true } },
      },
    });
    if (!lookup?.tenant?.isActive) return null;

    const ok = await bcrypt.compare(password, lookup.passwordHash);
    if (!ok) return null;

    await this.rbac.ensureTenantRolesSynced(lookup.tenantId);

    const user = await this.prisma.user.findUnique({
      where: { id: lookup.id },
      include: USER_WITH_ROLES_INCLUDE,
    });
    if (!user?.tenant?.isActive || !user.isActive) return null;

    return this.toAuthProfile(user);
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokenAndUser(user, dto.rememberMe);
  }

  issueTokenAndUser(
    user: {
      id: string;
      email: string;
      tenantId: string;
      tenantName: string;
      firstName: string;
      lastName: string;
      isSuperAdmin: boolean;
      roles: string[];
      permissions: string[];
    },
    rememberMe = false,
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles,
      permissions: user.permissions,
      isSuperAdmin: user.isSuperAdmin,
    };
    const accessToken = this.jwt.sign(payload, {
      expiresIn: rememberMe ? '30d' : '24h',
    });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        tenantName: user.tenantName,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
        roles: user.roles,
        permissions: user.permissions,
      },
    };
  }

  /**
   * Find all tenants where the user's email has an active account.
   * Used to populate the tenant switcher dropdown.
   */
  async getMyTenants(userId: string) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        isSuperAdmin: true,
        userRoles: { select: { role: { select: { key: true } } } },
      },
    });
    if (!currentUser) throw new UnauthorizedException('User not found');

    // Super admins and tenant_owner role holders see all active tenants
    const hasTenantOwnerRole = (currentUser.userRoles ?? []).some((ur) => ur.role?.key === 'tenant_owner');
    if (currentUser.isSuperAdmin || hasTenantOwnerRole) {
      const all = await this.prisma.tenant.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      });
      return all.map((t) => ({ id: t.id, name: t.name, slug: t.slug }));
    }

    // Tenants where this user has a dedicated user record (same email across tenants)
    const userRecords = await this.prisma.user.findMany({
      where: {
        email: currentUser.email,
        isActive: true,
        tenant: { isActive: true },
      },
      select: {
        id: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    // Tenants explicitly assigned via user_tenants mapping. Include mapping rows
    // for any user account that shares the same email so assigned tenants are
    // visible regardless of which tenant-specific user record the user is
    // currently using to authenticate.
    const emailUserIds = userRecords.map((r) => r.id);
    if (!emailUserIds.includes(userId)) emailUserIds.push(userId);
    const assigned = await this.prisma.userTenant.findMany({
      where: { userId: { in: emailUserIds } },
      include: { tenant: { select: { id: true, name: true, slug: true, isActive: true } } },
    });

    const combined = [
      ...userRecords.map((r) => r.tenant),
      ...assigned.filter((a) => a.tenant?.isActive).map((a) => a.tenant),
    ];

    // Deduplicate by tenant id and sort by name
    const map = new Map<string, { id: string; name: string; slug: string }>();
    for (const t of combined) {
      if (!t) continue;
      map.set(t.id, { id: t.id, name: t.name, slug: t.slug });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Switch to another tenant. Finds the user record in the target tenant
   * by matching the current user's email, then issues a fresh JWT for that record.
   */
  async switchTenant(currentUserId: string, targetTenantId: string) {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { email: true },
    });
    if (!currentUser) throw new UnauthorizedException('User not found');

    const targetUser = await this.prisma.user.findFirst({
      where: {
        email: currentUser.email,
        tenantId: targetTenantId,
        isActive: true,
        tenant: { isActive: true },
      },
      include: USER_WITH_ROLES_INCLUDE,
    });

    if (!targetUser) {
      throw new UnauthorizedException(
        'You do not have access to this tenant',
      );
    }

    return this.issueTokenAndUser(this.toAuthProfile(targetUser));
  }

  async refreshToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_WITH_ROLES_INCLUDE,
    });

    if (!user || !user.isActive || !user.tenant?.isActive) {
      throw new UnauthorizedException('User or tenant is no longer active');
    }

    return this.issueTokenAndUser(this.toAuthProfile(user));
  }

  async validatePayload(payload: JwtPayload) {
    const cacheKey = `jwt:active:${payload.sub}`;
    const cached = await this.cache.get<{ active: boolean; isSuperAdmin?: boolean } | boolean>(cacheKey);

    // Cache hit — skip DB entirely
    if (cached !== undefined && cached !== null) {
      const active = typeof cached === 'boolean' ? cached : cached.active;
      const isSuperAdmin = typeof cached === 'boolean' ? (payload.isSuperAdmin ?? false) : (cached.isSuperAdmin ?? payload.isSuperAdmin ?? false);
      if (!active) return null;
      return { ...payload, roles: payload.roles ?? [], permissions: payload.permissions ?? [], isSuperAdmin };
    }

    // Cache miss — lightweight DB check (only booleans, no relations)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, isSuperAdmin: true, tenant: { select: { isActive: true } } },
    });

    const active = !!(user?.isActive && user?.tenant?.isActive);
    const isSuperAdmin = user?.isSuperAdmin ?? payload.isSuperAdmin ?? false;
    await this.cache.set(cacheKey, { active, isSuperAdmin }, JWT_CACHE_TTL);

    if (!active) return null;
    return { ...payload, roles: payload.roles ?? [], permissions: payload.permissions ?? [], isSuperAdmin };
  }

  /** Force re-check on next request — works across all containers via Redis */
  async invalidateUserCache(userId: string) {
    await this.cache.del(`jwt:active:${userId}`);
  }
}
