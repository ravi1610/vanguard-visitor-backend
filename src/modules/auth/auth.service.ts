import {
  Injectable,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
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

@Injectable()
export class AuthService implements OnModuleInit {
  /** In-memory cache: skip DB on every JWT validation, recheck every 5 min */
  private activeCache = new Map<string, { active: boolean; at: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private rbac: RbacService,
  ) {}

  async onModuleInit() {
    await this.rbac.seedPermissionsIfNeeded();
    await this.rbac.syncAllTenantsDefaultRoles();
  }

  /** Map a user record (with nested roles) to a flat auth profile */
  private toAuthProfile(user: {
    id: string;
    email: string;
    tenantId: string;
    firstName: string;
    lastName: string;
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
    const now = Date.now();
    const cached = this.activeCache.get(payload.sub);

    // Cache hit — skip DB entirely
    if (cached && now - cached.at < AuthService.CACHE_TTL) {
      if (!cached.active) return null;
      return { ...payload, roles: payload.roles ?? [], permissions: payload.permissions ?? [] };
    }

    // Cache miss or stale — lightweight DB check (only booleans, no relations)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, tenant: { select: { isActive: true } } },
    });

    const active = !!(user?.isActive && user?.tenant?.isActive);
    this.activeCache.set(payload.sub, { active, at: now });

    if (!active) return null;
    return { ...payload, roles: payload.roles ?? [], permissions: payload.permissions ?? [] };
  }

  /** Force re-check on next request (call when deactivating a user) */
  invalidateUserCache(userId: string) {
    this.activeCache.delete(userId);
  }
}
