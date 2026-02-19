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
    // Lightweight: only inserts genuinely new permission keys (skips if none missing)
    await this.rbac.seedPermissionsIfNeeded();
    // Role sync now runs in background — doesn't block server startup
    this.rbac.syncAllTenantsDefaultRoles().catch((err) => {
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
  }) {
    const roles = user.userRoles.map((ur) => ur.role.key);
    const permissions = this.rbac.getPermissionsFromRoles(
      user.userRoles.map((ur) => ur.role),
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
      permissions,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), isActive: true },
      include: USER_WITH_ROLES_INCLUDE,
    });
    if (!user?.tenant?.isActive) return null;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;

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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    // Find all active user records with the same email across all active tenants
    const userRecords = await this.prisma.user.findMany({
      where: {
        email: user.email,
        isActive: true,
        tenant: { isActive: true },
      },
      select: {
        id: true,
        tenantId: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { tenant: { name: 'asc' } },
    });

    return userRecords.map((r) => ({
      id: r.tenant.id,
      name: r.tenant.name,
      slug: r.tenant.slug,
    }));
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
    const cached = await this.cache.get<boolean>(cacheKey);

    // Cache hit — skip DB entirely
    if (cached !== undefined && cached !== null) {
      if (!cached) return null;
      return { ...payload, roles: payload.roles ?? [], permissions: payload.permissions ?? [], isSuperAdmin: payload.isSuperAdmin ?? false };
    }

    // Cache miss — lightweight DB check (only booleans, no relations)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, tenant: { select: { isActive: true } } },
    });

    const active = !!(user?.isActive && user?.tenant?.isActive);
    await this.cache.set(cacheKey, active, JWT_CACHE_TTL);

    if (!active) return null;
    return { ...payload, roles: payload.roles ?? [], permissions: payload.permissions ?? [], isSuperAdmin: payload.isSuperAdmin ?? false };
  }

  /** Force re-check on next request — works across all containers via Redis */
  async invalidateUserCache(userId: string) {
    await this.cache.del(`jwt:active:${userId}`);
  }
}
