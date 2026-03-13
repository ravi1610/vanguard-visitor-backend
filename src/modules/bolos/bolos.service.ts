import { Injectable, NotFoundException } from '@nestjs/common';
import { BoloStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateBoloDto } from './dto/create-bolo.dto';
import { UpdateBoloDto } from './dto/update-bolo.dto';
import { NotificationsService } from '../notifications/notifications.service';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';
import { applyFilters, equals } from '../../common/utils/filter-utils';

export const BOLO_FIELD_MAPPING: FieldMapping[] = [
  { field: 'personName', header: 'Person Name', required: true },
  { field: 'description', header: 'Description' },
  { field: 'vehicleMake', header: 'Vehicle Make' },
  { field: 'vehicleModel', header: 'Vehicle Model' },
  { field: 'vehicleColor', header: 'Vehicle Color' },
  { field: 'licensePlate', header: 'License Plate' },
  { field: 'priority', header: 'Priority' },
  { field: 'notes', header: 'Notes' },
];

const BOLO_SORT_FIELDS = [
  'personName',
  'status',
  'priority',
  'licensePlate',
  'createdAt',
  'expiresAt',
] as const;

const BOLO_INCLUDE = {
  createdBy: {
    select: { id: true, firstName: true, lastName: true },
  },
  resolvedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
};

@Injectable()
export class BolosService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(tenantId: string, dto: CreateBoloDto, createdById: string) {
    const bolo = await this.prisma.bolo.create({
      data: {
        tenantId,
        personName: dto.personName,
        description: dto.description,
        vehicleMake: dto.vehicleMake,
        vehicleModel: dto.vehicleModel,
        vehicleColor: dto.vehicleColor,
        vehicleDescription: dto.vehicleDescription,
        licensePlate: dto.licensePlate,
        notes: dto.notes,
        priority: dto.priority ?? 'medium',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        createdById,
      },
      include: BOLO_INCLUDE,
    });

    // Notify all active security users
    this.prisma.user.findMany({
      where: { tenantId, isActive: true, userRoles: { some: { role: { key: 'security' } } } },
      select: { id: true },
    }).then((users) => {
      for (const user of users) {
        this.notifications.notify({
          tenantId,
          eventType: 'bolo.alert',
          recipientUserId: user.id,
          data: {
            personName: dto.personName || 'Unknown',
            description: dto.description || 'No description',
          },
        }).catch(() => {});
      }
    }).catch(() => {});

    return bolo;
  }

  async findAll(tenantId: string, query: PagedQueryDto, status?: string) {
    const where: { tenantId: string; status?: BoloStatus; OR?: object[] } = {
      tenantId,
    };

    if (status) where.status = status as BoloStatus;

    applyFilters(where, query.filters, { status: equals('status') });

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { personName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { licensePlate: { contains: search, mode: 'insensitive' } },
        { vehicleMake: { contains: search, mode: 'insensitive' } },
        { vehicleModel: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField =
      query.sortField &&
      BOLO_SORT_FIELDS.includes(
        query.sortField as (typeof BOLO_SORT_FIELDS)[number],
      )
        ? query.sortField
        : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.bolo.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: BOLO_INCLUDE,
      }),
      this.prisma.bolo.count({ where }),
    ]);

    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const bolo = await this.prisma.bolo.findFirst({
      where: { id, tenantId },
      include: BOLO_INCLUDE,
    });
    if (!bolo) throw new NotFoundException('BOLO not found');
    return bolo;
  }

  async update(tenantId: string, id: string, dto: UpdateBoloDto) {
    await this.findOne(tenantId, id);
    return this.prisma.bolo.update({
      where: { id },
      data: {
        ...(dto.personName !== undefined && { personName: dto.personName }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.vehicleMake !== undefined && { vehicleMake: dto.vehicleMake }),
        ...(dto.vehicleModel !== undefined && {
          vehicleModel: dto.vehicleModel,
        }),
        ...(dto.vehicleColor !== undefined && {
          vehicleColor: dto.vehicleColor,
        }),
        ...(dto.vehicleDescription !== undefined && {
          vehicleDescription: dto.vehicleDescription,
        }),
        ...(dto.licensePlate !== undefined && {
          licensePlate: dto.licensePlate,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.expiresAt !== undefined && {
          expiresAt: new Date(dto.expiresAt),
        }),
      },
      include: BOLO_INCLUDE,
    });
  }

  async resolve(tenantId: string, id: string, resolvedById: string) {
    await this.findOne(tenantId, id);
    return this.prisma.bolo.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedDate: new Date(),
        resolvedById,
      },
      include: BOLO_INCLUDE,
    });
  }

  async updatePhoto(tenantId: string, id: string, photoUrl: string) {
    await this.findOne(tenantId, id);
    return this.prisma.bolo.update({
      where: { id },
      data: { photoUrl },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.bolo.delete({ where: { id } });
  }

  async exportAll(tenantId: string, selectedIds?: string[], status?: string) {
    const where: any = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    if (status) where.status = status;
    return this.prisma.bolo.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async bulkImport(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.personName || !String(row.personName).trim()) { result.errors.push({ row: i + 2, message: 'Missing required: Person Name' }); continue; }
        const data: Record<string, unknown> = { tenantId, personName: String(row.personName ?? '') };
        if (row.description) data.description = String(row.description);
        if (row.vehicleMake) data.vehicleMake = String(row.vehicleMake);
        if (row.vehicleModel) data.vehicleModel = String(row.vehicleModel);
        if (row.vehicleColor) data.vehicleColor = String(row.vehicleColor);
        if (row.licensePlate) data.licensePlate = String(row.licensePlate);
        if (row.priority) data.priority = String(row.priority);
        if (row.notes) data.notes = String(row.notes);
        await this.prisma.bolo.create({ data: data as any });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }
}
