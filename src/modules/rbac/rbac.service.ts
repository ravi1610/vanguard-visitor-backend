import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '../../prisma/prisma.service';

const RBAC_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const CRUDIEX_ACTIONS = [
  'create',
  'read',
  'update',
  'delete',
  'import',
  'export',
] as const;
const MODULE_KEYS = [
  'tenant',
  'user',
  'visitor',
  'visit',
  'staff',
  'vehicles',
  'spaces',
  'maintenance',
  'projects',
  'calendar',
  'documents',
  'compliance',
  'vendors',
  'reports',
  'bolos',
  'packages',
  'violations',
  'pets',
  'emergencyContacts',
  'units',
  'residents',
  'permissions',
] as const;

const GRANULAR_PERMISSION_KEYS = MODULE_KEYS.flatMap((moduleKey) =>
  CRUDIEX_ACTIONS.map((action) => `${moduleKey}.${action}`),
);

const PERMISSION_KEYS = [
  ...GRANULAR_PERMISSION_KEYS,
  'tenant.manage',
  'user.manage',
  'visitor.view',
  'visitor.manage',
  'visit.view',
  'visit.checkin',
  'visit.checkout',
  'visit.view_history',
  'staff.view',
  'staff.manage',
  'vehicles.view',
  'vehicles.manage',
  'spaces.view',
  'spaces.manage',
  'maintenance.view',
  'maintenance.manage',
  'projects.view',
  'projects.manage',
  'calendar.view',
  'calendar.manage',
  'documents.view',
  'documents.manage',
  'compliance.view',
  'compliance.manage',
  'vendors.view',
  'vendors.manage',
  'reports.view',
  'reports.manage',
  'bolos.view',
  'bolos.manage',
  'packages.view',
  'packages.manage',
  'violations.view',
  'violations.manage',
  'pets.view',
  'pets.manage',
  'emergencyContacts.view',
  'emergencyContacts.manage',
  'units.view',
  'units.manage',
  'permissions.view',
  'permissions.manage',
] as const;

// Keys of roles that are always system-defined and can never be created or
// claimed by user-defined custom roles.
const SYSTEM_ROLE_KEYS = new Set([
  'tenant_owner',
  'admin',
  'receptionist',
  'security',
  'resident',
]);

const DEFAULT_ROLES: Record<
  string,
  { name: string; description: string; permissions: readonly string[] }
> = {
  tenant_owner: {
    name: 'Tenant Owner',
    description: 'Full control over tenant, users, and configuration',
    permissions: PERMISSION_KEYS, // tenant_owner gets ALL permissions
  },
  admin: {
    name: 'Admin',
    description: 'Administrative access to all operational modules',
    permissions: PERMISSION_KEYS.filter((key) => key !== 'tenant.manage'),
  },
  receptionist: {
    name: 'Receptionist',
    description: 'Manage visitors and visits',
    permissions: [
      'visitor.read',
      'visitor.create',
      'visitor.update',
      'visitor.delete',
      'visit.read',
      'visit.create',
      'visit.update',
      'packages.read',
      'packages.create',
      'packages.update',
      'bolos.read',
      'visitor.view',
      'visitor.manage',
      'visit.view',
      'visit.checkin',
      'visit.checkout',
      'visit.view_history',
      'packages.view',
      'packages.manage',
      'bolos.view',
    ],
  },
  security: {
    name: 'Security',
    description: 'View visits and check out visitors',
    permissions: [
      'user.read',
      'visit.read',
      'visit.create',
      'visit.update',
      'vehicles.read',
      'bolos.read',
      'packages.read',
      'visit.view',
      'visit.checkout',
      'visit.view_history',
      'bolos.view',
      'bolos.manage',
      'vehicles.view',
      'packages.view',
    ],
  },
  resident: {
    name: 'Resident',
    description: 'Resident user (no dashboard permissions)',
    permissions: [],
  },
};

function normalizeRoleKey(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

@Injectable()
export class RbacService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private tenantRoleSyncPromises = new Map<string, Promise<void>>();
  private tenantRolesSynced = new Set<string>();

  private expandLegacyPermissions(keys: string[]): string[] {
    const expanded = new Set(keys);
    const byModule = new Map<string, Set<string>>();

    for (const key of keys) {
      const [moduleKey, action] = key.split('.');
      if (!moduleKey || !action) continue;
      if (!byModule.has(moduleKey)) byModule.set(moduleKey, new Set());
      byModule.get(moduleKey)!.add(action);
    }

    for (const [moduleKey, actions] of byModule) {
      if (actions.has('read')) expanded.add(`${moduleKey}.view`);
      // Keep override control per action — do not auto-add module.manage

      if (
        moduleKey === 'visit' &&
        (actions.has('create') || actions.has('update'))
      ) {
        expanded.add('visit.checkin');
      }
      if (moduleKey === 'visit' && actions.has('update')) {
        expanded.add('visit.checkout');
      }
      if (moduleKey === 'visit' && actions.has('read')) {
        expanded.add('visit.view_history');
      }
    }

    return Array.from(expanded);
  }

  private async ensureUniqueRoleKey(
    tenantId: string,
    key: string,
    excludeRoleId?: string,
  ) {
    const existing = await this.prisma.role.findFirst({
      where: {
        tenantId,
        key,
        ...(excludeRoleId ? { NOT: { id: excludeRoleId } } : {}),
      },
    });
    if (existing) {
      throw new BadRequestException('Role key already exists');
    }
  }

  getPermissionsFromRoles(
    roles: { rolePermissions: { permission: { key: string } }[] }[],
  ): string[] {
    const set = new Set<string>();
    for (const role of roles) {
      for (const rp of role.rolePermissions) {
        set.add(rp.permission.key);
      }
    }
    return Array.from(set);
  }

  getEffectivePermissions(
    roles: { rolePermissions: { permission: { key: string } }[] }[],
    userPermissions: {
      effect: 'allow' | 'deny';
      permission: { key: string };
    }[],
  ) {
    const inherited = this.getPermissionsFromRoles(roles);
    const effective = new Set(inherited);
    const grants: string[] = [];
    const denies: string[] = [];

    for (const override of userPermissions) {
      if (override.effect === 'allow') {
        effective.add(override.permission.key);
        grants.push(override.permission.key);
      } else {
        effective.delete(override.permission.key);
        denies.push(override.permission.key);
      }
    }

    // Cascade: deny of X.read removes X.view from effective (they are synonymous).
    // Deny of X.view similarly removes X.read.
    // This prevents inherited .view permissions from surviving a .read deny.
    for (const deny of denies) {
      const lastDot = deny.lastIndexOf('.');
      if (lastDot < 0) continue;
      const moduleKey = deny.substring(0, lastDot);
      const action = deny.substring(lastDot + 1);
      if (action === 'read') {
        effective.delete(`${moduleKey}.view`);
        if (moduleKey === 'visit') {
          effective.delete('visit.view_history');
        }
      } else if (action === 'view') {
        effective.delete(`${moduleKey}.read`);
      }
    }
    // Visit-specific cascades based on remaining effective permissions
    if (!effective.has('visit.create') && !effective.has('visit.update')) {
      effective.delete('visit.checkin');
    }
    if (!effective.has('visit.update')) {
      effective.delete('visit.checkout');
    }

    const inheritedExpanded = this.expandLegacyPermissions(inherited).sort();
    const grantsExpanded = this.expandLegacyPermissions(grants).sort();
    const deniesExpanded = this.expandLegacyPermissions(denies).sort();
    const effectiveExpanded = this.expandLegacyPermissions(
      Array.from(effective),
    ).sort();

    return {
      inherited: inheritedExpanded,
      grants: grants.sort(),
      denies: denies.sort(),
      grantsExpanded,
      deniesExpanded,
      effective: effectiveExpanded,
    };
  }

  async seedPermissionsIfNeeded(): Promise<Set<string>> {
    const existing = await this.prisma.permission.findMany({
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((p) => p.key));
    const toCreate = PERMISSION_KEYS.filter((key) => !existingKeys.has(key));
    if (toCreate.length > 0) {
      await this.prisma.permission.createMany({
        data: toCreate.map((key) => ({
          key,
          description: key.replace('.', ' '),
        })),
        skipDuplicates: true,
      });
    }
    return new Set(toCreate);
  }

  /**
   * Optimized: batch-load all roles for a tenant in ONE query,
   * then reconcile missing permissions with a single createMany per role.
   *
   * newPermKeys: only permissions in this set are auto-added to existing admin/tenant_owner
   * roles. Pass an empty Set (default) to skip auto-adding to existing roles.
   */
  async seedDefaultRolesForTenant(
    tenantId: string,
    newPermKeys: Set<string> = new Set(),
  ) {
    // Single query: get all permissions
    const permissions = await this.prisma.permission.findMany({
      select: { id: true, key: true },
    });
    const keyToId = new Map(permissions.map((p) => [p.key, p.id]));
    const idToKey = new Map(permissions.map((p) => [p.id, p.key]));

    // Single query: get all existing roles + their permissions for this tenant
    const existingRoles = await this.prisma.role.findMany({
      where: { tenantId },
      include: { rolePermissions: { select: { permissionId: true } } },
    });
    const roleByKey = new Map(existingRoles.map((r) => [r.key, r]));

    for (const [roleKey, def] of Object.entries(DEFAULT_ROLES)) {
      const existing = roleByKey.get(roleKey);

      if (existing) {
        // Ensure existing system roles have isSystemDefined = true (migration for existing data).
        if (!existing.isSystemDefined) {
          await this.prisma.role.update({
            where: { id: existing.id },
            data: { isSystemDefined: true },
          });
        }

        // For system roles, append:
        //   (a) truly new permission keys (just added to PERMISSION_KEYS for the first time)
        //   (b) the minimum set admin always needs (permissions.*) — prevents a broken UI
        // Never restore other manually-removed permissions.
        if (roleKey === 'tenant_owner' || roleKey === 'admin') {
          const MINIMUM_ADMIN_KEYS = new Set([
            'permissions.read',
            'permissions.view',
            'permissions.manage',
            'permissions.create',
            'permissions.update',
            'permissions.delete',
          ]);
          const keysToEnsure = new Set([...newPermKeys, ...MINIMUM_ADMIN_KEYS]);
          const existingPermIds = new Set(
            existing.rolePermissions.map((rp) => rp.permissionId),
          );
          const expectedPermIds = def.permissions
            .map((k) => keyToId.get(k))
            .filter(Boolean) as string[];
          const missingPermIds = expectedPermIds.filter((id) => {
            if (existingPermIds.has(id)) return false;
            const key = idToKey.get(id);
            return key ? keysToEnsure.has(key) : false;
          });
          if (missingPermIds.length > 0) {
            await this.prisma.rolePermission.createMany({
              data: missingPermIds.map((permissionId) => ({
                roleId: existing.id,
                permissionId,
              })),
              skipDuplicates: true,
            });
          }
        }
        // For other roles, preserve tenant-specific customization.
        continue;
      }

      // Role doesn't exist — create it + assign permissions in one go
      const role = await this.prisma.role.create({
        data: {
          tenantId,
          name: def.name,
          key: roleKey,
          description: def.description,
          isSystemDefined: true,
        },
      });

      const permIds = def.permissions
        .map((k) => keyToId.get(k))
        .filter(Boolean) as string[];
      if (permIds.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: permIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Invalidate cached roles after seeding/updating
    await this.cache.del(`rbac:roles:${tenantId}`);
  }

  /**
   * Sync default role permissions for all tenants.
   * Optimized: processes tenants concurrently (batch of 5) instead of sequentially.
   */
  async syncAllTenantsDefaultRoles(newPermKeys: Set<string> = new Set()) {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true },
    });

    // Process in batches of 5 to avoid overwhelming the DB connection pool
    const BATCH_SIZE = 5;
    for (let i = 0; i < tenants.length; i += BATCH_SIZE) {
      const batch = tenants.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((t) => this.seedDefaultRolesForTenant(t.id, newPermKeys)),
      );
    }
  }

  async ensureTenantRolesSynced(tenantId: string) {
    if (!tenantId) return;
    if (this.tenantRolesSynced.has(tenantId)) return;

    const inFlight = this.tenantRoleSyncPromises.get(tenantId);
    if (inFlight) {
      await inFlight;
      return;
    }

    const promise = this.seedDefaultRolesForTenant(tenantId)
      .then(() => {
        this.tenantRolesSynced.add(tenantId);
      })
      .finally(() => {
        this.tenantRoleSyncPromises.delete(tenantId);
      });

    this.tenantRoleSyncPromises.set(tenantId, promise);
    await promise;
  }

  async createRole(
    tenantId: string,
    dto: { name: string; key: string; description?: string | null },
  ) {
    const trimmedName = dto.name?.trim() ?? '';
    if (!trimmedName) throw new BadRequestException('Role name is required');
    const normalizedKey = normalizeRoleKey(dto.key ?? '');
    if (!normalizedKey) throw new BadRequestException('Role key is required');
    if (SYSTEM_ROLE_KEYS.has(normalizedKey)) {
      throw new BadRequestException(
        `Role key "${normalizedKey}" is reserved for system use`,
      );
    }
    await this.ensureUniqueRoleKey(tenantId, normalizedKey);
    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: trimmedName,
        key: normalizedKey,
        description: dto.description?.trim() || null,
      },
    });
    await this.cache.del(`rbac:roles:${tenantId}`);
    return role;
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    dto: { name?: string; key?: string; description?: string | null },
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) throw new NotFoundException('Role not found');

    if (
      role.isSystemDefined &&
      (dto.name !== undefined || dto.key !== undefined)
    ) {
      throw new BadRequestException(
        'System-defined roles cannot have their name or key changed',
      );
    }

    const updates: {
      name?: string;
      key?: string;
      description?: string | null;
    } = {};
    if (dto.name !== undefined) {
      const trimmed = dto.name.trim();
      if (!trimmed) throw new BadRequestException('Role name cannot be empty');
      updates.name = trimmed;
    }
    if (dto.description !== undefined) {
      const desc = dto.description?.trim() ?? '';
      updates.description = desc || null;
    }
    if (dto.key !== undefined) {
      const normalizedKey = normalizeRoleKey(dto.key);
      if (!normalizedKey) throw new BadRequestException('Role key is required');
      await this.ensureUniqueRoleKey(tenantId, normalizedKey, role.id);
      updates.key = normalizedKey;
    }
    if (!Object.keys(updates).length) {
      return role;
    }
    const updated = await this.prisma.role.update({
      where: { id: roleId },
      data: updates,
    });
    await this.cache.del(`rbac:roles:${tenantId}`);
    return updated;
  }

  async deleteRole(tenantId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystemDefined) {
      throw new BadRequestException('System-defined roles cannot be deleted');
    }
    await this.prisma.role.delete({ where: { id: roleId } });
    await this.cache.del(`rbac:roles:${tenantId}`);
  }

  async getRolesForTenant(tenantId: string) {
    const cacheKey = `rbac:roles:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const roles = await this.prisma.role.findMany({
      where: { tenantId },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });

    await this.cache.set(cacheKey, roles, RBAC_CACHE_TTL);
    return roles;
  }

  async getPermissionCatalog() {
    const rows = await this.prisma.permission.findMany({
      select: { key: true, description: true },
      orderBy: { key: 'asc' },
    });
    return rows;
  }

  async getPermissionMatrix(tenantId: string) {
    const [permissions, roles] = await Promise.all([
      this.getPermissionCatalog(),
      this.prisma.role.findMany({
        where: { tenantId },
        include: { rolePermissions: { include: { permission: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      permissions,
      roles: roles.map((role) => ({
        id: role.id,
        key: role.key,
        name: role.name,
        description: role.description,
        isSystemDefined: role.isSystemDefined,
        permissionKeys: role.rolePermissions
          .map((rp) => rp.permission.key)
          .sort(),
      })),
    };
  }

  async setRolePermissions(
    tenantId: string,
    roleId: string,
    permissionKeys: string[],
  ) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });
    if (!role) throw new NotFoundException('Role not found');

    const normalizedKeys = Array.from(
      new Set((permissionKeys ?? []).map((key) => key.trim()).filter(Boolean)),
    );

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: normalizedKeys } },
      select: { id: true, key: true },
    });
    const foundKeys = new Set(permissions.map((p) => p.key));
    const missing = normalizedKeys.filter((key) => !foundKeys.has(key));
    if (missing.length) {
      throw new BadRequestException(
        `Unknown permission keys: ${missing.join(', ')}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...(permissions.length
        ? [
            this.prisma.rolePermission.createMany({
              data: permissions.map((permission) => ({
                roleId,
                permissionId: permission.id,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    await this.cache.del(`rbac:roles:${tenantId}`);
    return this.getPermissionMatrix(tenantId);
  }

  async getUserPermissionProfile(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
        userPermissions: {
          include: { permission: true },
          orderBy: { permission: { key: 'asc' } },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const roleSnapshots = user.userRoles.map((item) => item.role);
    const roleKeys = roleSnapshots.map((role) => role.key).sort();
    const effective = this.getEffectivePermissions(
      roleSnapshots,
      user.userPermissions.map((item) => ({
        effect: item.effect,
        permission: { key: item.permission.key },
      })),
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleKeys,
      },
      ...effective,
    };
  }

  async setUserPermissionOverrides(
    tenantId: string,
    userId: string,
    grants: string[],
    denies: string[],
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException('User not found');

    const grantKeys = Array.from(
      new Set((grants ?? []).map((key) => key.trim()).filter(Boolean)),
    );
    const denyKeys = Array.from(
      new Set((denies ?? []).map((key) => key.trim()).filter(Boolean)),
    );
    const overlap = grantKeys.filter((key) => denyKeys.includes(key));
    if (overlap.length) {
      throw new BadRequestException(
        `Cannot both grant and deny: ${overlap.join(', ')}`,
      );
    }

    const allKeys = Array.from(new Set([...grantKeys, ...denyKeys]));
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: allKeys } },
      select: { id: true, key: true },
    });
    const keyToId = new Map(
      permissions.map((permission) => [permission.key, permission.id]),
    );
    const missing = allKeys.filter((key) => !keyToId.has(key));
    if (missing.length) {
      throw new BadRequestException(
        `Unknown permission keys: ${missing.join(', ')}`,
      );
    }

    const creates = [
      ...grantKeys.map((key) => ({
        userId,
        permissionId: keyToId.get(key)!,
        effect: 'allow' as const,
      })),
      ...denyKeys.map((key) => ({
        userId,
        permissionId: keyToId.get(key)!,
        effect: 'deny' as const,
      })),
    ];

    await this.prisma.$transaction([
      this.prisma.userPermission.deleteMany({ where: { userId } }),
      ...(creates.length
        ? [
            this.prisma.userPermission.createMany({
              data: creates,
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    return this.getUserPermissionProfile(tenantId, userId);
  }
}
