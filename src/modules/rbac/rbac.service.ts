import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '../../prisma/prisma.service';

const RBAC_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const PERMISSION_KEYS = [
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
] as const;

const DEFAULT_ROLES: Record<
  string,
  { name: string; description: string; permissions: readonly string[] }
> = {
  tenant_owner: {
    name: 'Tenant Owner',
    description: 'Full control over tenant, users, and configuration',
    permissions: PERMISSION_KEYS, // tenant_owner gets ALL permissions
  },
  receptionist: {
    name: 'Receptionist',
    description: 'Manage visitors and visits',
    permissions: [
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

@Injectable()
export class RbacService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  getPermissionsFromRoles(roles: { rolePermissions: { permission: { key: string } }[] }[]): string[] {
    const set = new Set<string>();
    for (const role of roles) {
      for (const rp of role.rolePermissions) {
        set.add(rp.permission.key);
      }
    }
    return Array.from(set);
  }

  async seedPermissionsIfNeeded() {
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
  }

  /**
   * Optimized: batch-load all roles for a tenant in ONE query,
   * then reconcile missing permissions with a single createMany per role.
   */
  async seedDefaultRolesForTenant(tenantId: string) {
    // Single query: get all permissions
    const permissions = await this.prisma.permission.findMany({ select: { id: true, key: true } });
    const keyToId = new Map(permissions.map((p) => [p.key, p.id]));

    // Single query: get all existing roles + their permissions for this tenant
    const existingRoles = await this.prisma.role.findMany({
      where: { tenantId },
      include: { rolePermissions: { select: { permissionId: true } } },
    });
    const roleByKey = new Map(existingRoles.map((r) => [r.key, r]));

    for (const [roleKey, def] of Object.entries(DEFAULT_ROLES)) {
      const existing = roleByKey.get(roleKey);

      if (existing) {
        // Role exists — add only missing permissions (single batch)
        const existingPermIds = new Set(existing.rolePermissions.map((rp) => rp.permissionId));
        const permIdsToAdd = def.permissions
          .map((k) => keyToId.get(k))
          .filter((id): id is string => !!id && !existingPermIds.has(id));
        if (permIdsToAdd.length > 0) {
          await this.prisma.rolePermission.createMany({
            data: permIdsToAdd.map((permissionId) => ({
              roleId: existing.id,
              permissionId,
            })),
            skipDuplicates: true,
          });
        }
        continue;
      }

      // Role doesn't exist — create it + assign permissions in one go
      const role = await this.prisma.role.create({
        data: {
          tenantId,
          name: def.name,
          key: roleKey,
          description: def.description,
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
  async syncAllTenantsDefaultRoles() {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true },
    });

    // Process in batches of 5 to avoid overwhelming the DB connection pool
    const BATCH_SIZE = 5;
    for (let i = 0; i < tenants.length; i += BATCH_SIZE) {
      const batch = tenants.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map((t) => this.seedDefaultRolesForTenant(t.id)));
    }
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
}
