import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TenantsService {
  constructor(
    private prisma: PrismaService,
    private rbac: RbacService,
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

    // Fetch the creator so we can clone their profile into the new tenant
    const creator = await this.prisma.user.findUnique({
      where: { id: creatorUserId },
    });
    if (!creator) throw new NotFoundException('User not found');

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
          `A tenant with slug "${slug}" already exists. Please choose a different name or slug.`,
        );
      }
      throw error;
    }

    // Seed default roles (tenant_owner, receptionist, security, resident)
    await this.rbac.seedDefaultRolesForTenant(tenant.id);

    // Find the tenant_owner role we just created
    const ownerRole = await this.prisma.role.findUnique({
      where: {
        tenantId_key: { tenantId: tenant.id, key: 'tenant_owner' },
      },
    });

    // Clone the creator into the new tenant as tenant_owner
    if (ownerRole) {
      const clonedUser = await this.prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: creator.email,
          passwordHash: creator.passwordHash,
          firstName: creator.firstName,
          lastName: creator.lastName,
          isActive: true,
        },
      });

      await this.prisma.userRole.create({
        data: {
          userId: clonedUser.id,
          roleId: ownerRole.id,
        },
      });
    }

    return tenant;
  }

  async findMany(tenantId: string) {
    const hasManage = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });
    if (!hasManage) return [];
    return this.prisma.tenant.findMany({
      where: { id: tenantId },
      include: {
        _count: { select: { users: true } },
      },
    });
  }

  async getMyTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId, isActive: true },
      include: {
        _count: { select: { users: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(
    tenantId: string,
    requesterTenantId: string,
    dto: UpdateTenantDto,
  ) {
    if (requesterTenantId !== tenantId) {
      throw new ForbiddenException('Cannot update another tenant');
    }

    try {
      return await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(dto.name != null && { name: dto.name }),
          ...(dto.slug != null && { slug: dto.slug }),
          ...(dto.isActive != null && { isActive: dto.isActive }),
        },
      });
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
}
