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

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private rbac: RbacService,
  ) {}

  async onModuleInit() {
    await this.rbac.seedPermissionsIfNeeded();
    await this.rbac.syncAllTenantsDefaultRoles();
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), isActive: true },
      include: {
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
      },
    });
    if (!user?.tenant?.isActive) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;

    const roles = user.userRoles.map((ur) => ur.role.key);
    const permissions = this.rbac.getPermissionsFromRoles(
      user.userRoles.map((ur) => ur.role),
    );

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions,
    };
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
    // Get current user's email
    const currentUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { email: true },
    });
    if (!currentUser) throw new UnauthorizedException('User not found');

    // Find the user record in the target tenant with the same email
    const targetUser = await this.prisma.user.findFirst({
      where: {
        email: currentUser.email,
        tenantId: targetTenantId,
        isActive: true,
        tenant: { isActive: true },
      },
      include: {
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
      },
    });

    if (!targetUser) {
      throw new UnauthorizedException(
        'You do not have access to this tenant',
      );
    }

    const roles = targetUser.userRoles.map((ur) => ur.role.key);
    const permissions = this.rbac.getPermissionsFromRoles(
      targetUser.userRoles.map((ur) => ur.role),
    );

    return this.issueTokenAndUser({
      id: targetUser.id,
      email: targetUser.email,
      tenantId: targetUser.tenantId,
      tenantName: targetUser.tenant.name,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      roles,
      permissions,
    });
  }

  async refreshToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
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
      },
    });

    if (!user || !user.isActive || !user.tenant?.isActive) {
      throw new UnauthorizedException('User or tenant is no longer active');
    }

    const roles = user.userRoles.map((ur) => ur.role.key);
    const permissions = this.rbac.getPermissionsFromRoles(
      user.userRoles.map((ur) => ur.role),
    );

    return this.issueTokenAndUser({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      firstName: user.firstName,
      lastName: user.lastName,
      roles,
      permissions,
    });
  }

  async validatePayload(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });
    if (!user || !user.isActive || !user.tenant?.isActive) return null;
    return {
      ...payload,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
    };
  }
}
