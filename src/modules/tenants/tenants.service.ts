import {
  Inject,
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Prisma } from '@prisma/client';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

const TENANT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private rbac: RbacService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  /**
   * Create a new tenant, seed default roles, and clone the creating user
   * into the new tenant as tenant_owner (original user stays in their current tenant).
   */
async create(dto: CreateTenantDto, creatorUserId: string) {
  const slug =
    dto.slug ??
    dto.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

  // 🔹 Get creator
  const creator = await this.prisma.user.findUnique({
    where: { id: creatorUserId },
  });
  if (!creator) throw new NotFoundException('User not found');

  // ✅ FIX: Use global flag instead of role-based check
  const isSuperAdmin = creator.isSuperAdmin === true;

  let tenant: Awaited<ReturnType<typeof this.prisma.tenant.create>>;

  try {
    tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        isActive: dto.isActive ?? true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        `A tenant with slug "${slug}" already exists.`,
      );
    }
    throw error;
  }

  // 🔹 Seed roles
  await this.rbac.seedDefaultRolesForTenant(tenant.id);

  // =========================================================
  // 🔥 STEP 1: ADD GLOBAL SUPER ADMIN TO NEW TENANT
  // =========================================================

  // ✅ FIX: Find actual global super admin
  const superAdmin = await this.prisma.user.findFirst({
    where: {
      isSuperAdmin: true,
    },
  });

  if (superAdmin) {
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: superAdmin.email,
      },
    });

    if (!existing) {
      const newSuperAdmin = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: superAdmin.email,
          passwordHash: superAdmin.passwordHash,
          firstName: superAdmin.firstName,
          lastName: superAdmin.lastName,
          isActive: true,
          isSuperAdmin: true, // ✅ IMPORTANT
        },
      });

      const ownerRole = await this.prisma.role.findUnique({
        where: {
          tenantId_key: {
            tenantId: tenant.id,
            key: 'tenant_owner',
          },
        },
      });

      if (!ownerRole) {
        throw new NotFoundException('tenant_owner role not found');
      }

      await this.prisma.userRole.create({
        data: {
          userId: newSuperAdmin.id,
          roleId: ownerRole.id,
        },
      });
    }
  }

  // =========================================================
  // 🔥 STEP 2: ADD CREATOR (ADMIN OR OWNER)
  // =========================================================

  const roleKey = isSuperAdmin ? 'tenant_owner' : 'admin';

  const roleToAssign = await this.prisma.role.findUnique({
    where: {
      tenantId_key: {
        tenantId: tenant.id,
        key: roleKey,
      },
    },
  });

  if (!roleToAssign) {
    throw new NotFoundException(`Role "${roleKey}" not found`);
  }

  let emailToUse = creator.email;

  const existingCreator = await this.prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      email: creator.email,
    },
  });

  if (existingCreator) {
    emailToUse = `${creator.email}_${Date.now()}`;
  }

  const clonedUser = await this.prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: emailToUse,
      passwordHash: creator.passwordHash,
      firstName: creator.firstName,
      lastName: creator.lastName,
      isActive: true,
      isSuperAdmin: creator.isSuperAdmin, // ✅ IMPORTANT FIX
    },
  });

  await this.prisma.userRole.create({
    data: {
      userId: clonedUser.id,
      roleId: roleToAssign.id,
    },
  });

  return tenant;
}

  async findMany(
    tenantId: string,
    isSuperAdmin: boolean,
    query: PagedQueryDto,
    isActive?: string,
  ) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.max(1, Number(query.pageSize ?? 25));
    const skip = (page - 1) * pageSize;

    const where: Prisma.TenantWhereInput = {};

    if (!isSuperAdmin) {
      where.id = tenantId;
    }

    if (isActive != null && isActive !== '') {
      const normalized = String(isActive).toLowerCase();
      if (normalized === 'true' || normalized === 'active') where.isActive = true;
      if (normalized === 'false' || normalized === 'inactive') where.isActive = false;
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ];
    }

    const filterIsActive = query.filters?.isActive;
    if (filterIsActive != null) {
      const raw = Array.isArray(filterIsActive) ? filterIsActive[0] : filterIsActive;
      const val = String(raw).toLowerCase();
      if (val === 'true' || val === 'active') where.isActive = true;
      if (val === 'false' || val === 'inactive') where.isActive = false;
    }

    const sortField = ['name', 'slug', 'createdAt', 'isActive'].includes(query.sortField ?? '')
      ? (query.sortField as 'name' | 'slug' | 'createdAt' | 'isActive')
      : 'createdAt';
    const sortDir: Prisma.SortOrder = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        include: {
          _count: { select: { users: true } },
        },
        orderBy: { [sortField]: sortDir },
        skip,
        take: pageSize,
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { rows, total };
  }

  async getMyTenant(tenantId: string) {
    const cacheKey = `tenant:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId, isActive: true },
      include: {
        _count: { select: { users: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.cache.set(cacheKey, tenant, TENANT_CACHE_TTL);
    return tenant;
  }

  async update(
    tenantId: string,
    requesterTenantId: string,
    dto: UpdateTenantDto,
    isSuperAdmin = false,
  ) {
    if (!isSuperAdmin && requesterTenantId !== tenantId) {
      throw new ForbiddenException('Cannot update another tenant');
    }

    try {
      const updated = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(dto.name != null && { name: dto.name }),
          ...(dto.slug != null && { slug: dto.slug }),
          ...(dto.isActive != null && { isActive: dto.isActive }),
        },
      });

      await this.cache.del(`tenant:${tenantId}`);
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A tenant with this slug already exists. Please choose a different slug.',
        );
      }
      throw error;
    }
  }

  async remove(tenantId: string, isSuperAdmin = false) {
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only super-admin can delete tenants');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const deleted = await this.prisma.tenant.delete({ where: { id: tenantId } });
    await this.cache.del(`tenant:${tenantId}`);
    return deleted;
  }
}
