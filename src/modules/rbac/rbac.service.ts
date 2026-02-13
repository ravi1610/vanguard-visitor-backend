import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

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
] as const;

const DEFAULT_ROLES: Record<
  string,
  { name: string; description: string; permissions: readonly string[] }
> = {
  tenant_owner: {
    name: 'Tenant Owner',
    description: 'Full control over tenant, users, and configuration',
    permissions: [
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
    ],
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
    ],
  },
  security: {
    name: 'Security',
    description: 'View visits and check out visitors',
    permissions: ['visit.view', 'visit.checkout', 'visit.view_history'],
  },
  resident: {
    name: 'Resident',
    description: 'Resident user (no dashboard permissions)',
    permissions: [],
  },
};

@Injectable()
export class RbacService {
  constructor(private prisma: PrismaService) {}

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

  async seedDefaultRolesForTenant(tenantId: string) {
    const permissions = await this.prisma.permission.findMany();
    const keyToId = new Map(permissions.map((p) => [p.key, p.id]));

    for (const [roleKey, def] of Object.entries(DEFAULT_ROLES)) {
      const existing = await this.prisma.role.findUnique({
        where: {
          tenantId_key: { tenantId, key: roleKey },
        },
        include: {
          rolePermissions: { select: { permissionId: true } },
        },
      });

      if (existing) {
        const existingPermIds = new Set(
          existing.rolePermissions.map((rp) => rp.permissionId),
        );
        const permIdsToAdd = def.permissions
          .map((k) => keyToId.get(k))
          .filter((id): id is string => {
            if (!id) return false;
            return !existingPermIds.has(id);
          });
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
  }

  /** Sync default role permissions for all tenants (e.g. after adding new permissions). */
  async syncAllTenantsDefaultRoles() {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true },
    });
    for (const t of tenants) {
      await this.seedDefaultRolesForTenant(t.id);
    }
  }

  async getRolesForTenant(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });
  }
}
