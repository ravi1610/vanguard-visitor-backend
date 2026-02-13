import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';

const MAINT_SORT_FIELDS = ['title', 'status', 'dueDate', 'createdAt'] as const;

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateMaintenanceDto) {
    return this.prisma.maintenance.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'open',
        assignedToUserId: dto.assignedToUserId,
        propertyUnit: dto.propertyUnit,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto, status?: string, assignedToUserId?: string) {
    const where: {
      tenantId: string;
      status?: 'open' | 'in_progress' | 'completed' | 'cancelled';
      assignedToUserId?: string;
      OR?: object[];
    } = { tenantId };
    if (status)
      where.status = status as
        | 'open'
        | 'in_progress'
        | 'completed'
        | 'cancelled';
    if (assignedToUserId) where.assignedToUserId = assignedToUserId;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { propertyUnit: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && MAINT_SORT_FIELDS.includes(query.sortField as (typeof MAINT_SORT_FIELDS)[number]) ? query.sortField : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.maintenance.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.maintenance.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const m = await this.prisma.maintenance.findFirst({
      where: { id, tenantId },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!m) throw new NotFoundException('Maintenance not found');
    return m;
  }

  async update(tenantId: string, id: string, dto: UpdateMaintenanceDto) {
    await this.findOne(tenantId, id);
    return this.prisma.maintenance.update({
      where: { id },
      data: {
        ...(dto.title != null && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.assignedToUserId !== undefined && {
          assignedToUserId: dto.assignedToUserId,
        }),
        ...(dto.propertyUnit !== undefined && {
          propertyUnit: dto.propertyUnit,
        }),
        ...(dto.dueDate !== undefined && {
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        }),
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.maintenance.delete({ where: { id } });
  }
}
