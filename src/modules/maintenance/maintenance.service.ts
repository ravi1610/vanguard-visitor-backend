import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateSafe } from '../../common/utils/parse-date';
import { applyFilters, equals } from '../../common/utils/filter-utils';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { NotificationsService } from '../notifications/notifications.service';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';

export const MAINTENANCE_FIELD_MAPPING: FieldMapping[] = [
  { field: 'title', header: 'Title', required: true },
  { field: 'description', header: 'Description' },
  { field: 'status', header: 'Status' },
  { field: 'dueDate', header: 'Due Date' },
];

const MAINT_SORT_FIELDS = ['title', 'status', 'dueDate', 'createdAt'] as const;

@Injectable()
export class MaintenanceService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(tenantId: string, dto: CreateMaintenanceDto) {
    return this.prisma.maintenance.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'open',
        assignedToUserId: dto.assignedToUserId,
        unitId: dto.unitId,
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
    applyFilters(where, query.filters, { status: equals('status') });
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { unit: { unitNumber: { contains: search, mode: 'insensitive' } } },
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
          unit: { select: { id: true, unitNumber: true, building: true } },
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
        unit: { select: { id: true, unitNumber: true, building: true } },
      },
    });
    if (!m) throw new NotFoundException('Maintenance not found');
    return m;
  }

  async update(tenantId: string, id: string, dto: UpdateMaintenanceDto) {
    await this.findOne(tenantId, id);
    const updated = await this.prisma.maintenance.update({
      where: { id },
      data: {
        ...(dto.title != null && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.assignedToUserId !== undefined && {
          assignedToUserId: dto.assignedToUserId,
        }),
        ...(dto.unitId !== undefined && {
          unitId: dto.unitId || null,
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

    if (dto.status && updated.assignedToUserId) {
      this.notifications.notify({
        tenantId,
        eventType: 'maintenance.update',
        recipientUserId: updated.assignedToUserId,
        data: {
          title: updated.title,
          status: updated.status,
        },
      }).catch(() => {});
    }

    return updated;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.maintenance.delete({ where: { id } });
  }

  async exportAll(tenantId: string, selectedIds?: string[], status?: string) {
    const where: any = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    if (status) where.status = status;
    return this.prisma.maintenance.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async bulkImport(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.title || !String(row.title).trim()) { result.errors.push({ row: i + 2, message: 'Missing required: Title' }); continue; }
        const data: Record<string, unknown> = { tenantId, title: String(row.title ?? '') };
        if (row.description) data.description = String(row.description);
        if (row.status) data.status = String(row.status);
        if (row.dueDate) { const d = parseDateSafe(row.dueDate); if (d) data.dueDate = d; }
        await this.prisma.maintenance.create({ data: data as any });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }
}
