import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';

export const VEHICLE_FIELD_MAPPING: FieldMapping[] = [
  { field: 'plateNumber', header: 'Plate Number', required: true },
  { field: 'make', header: 'Make' },
  { field: 'model', header: 'Model' },
  { field: 'color', header: 'Color' },
  { field: 'year', header: 'Year' },
  { field: 'tagId', header: 'Tag ID' },
  { field: 'stickerNumber', header: 'Sticker Number' },
  { field: 'parkingSpace', header: 'Parking Space' },
  { field: 'notes', header: 'Notes' },
];

const VEHICLE_SORT_FIELDS = [
  'plateNumber',
  'make',
  'model',
  'color',
  'year',
  'ownerType',
  'parkingSpace',
  'createdAt',
] as const;

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({
      data: {
        tenantId,
        plateNumber: dto.plateNumber,
        make: dto.make,
        model: dto.model,
        color: dto.color,
        year: dto.year,
        ownerType: dto.ownerType ?? 'other',
        ownerId: dto.ownerId,
        unitId: dto.unitId,
        tagId: dto.tagId,
        stickerNumber: dto.stickerNumber,
        parkingSpace: dto.parkingSpace,
        isRestricted: dto.isRestricted ?? false,
        isPrimary: dto.isPrimary ?? true,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto, ownerId?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (ownerId) where.ownerId = ownerId;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { color: { contains: search, mode: 'insensitive' } },
        { tagId: { contains: search, mode: 'insensitive' } },
        { parkingSpace: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField =
      query.sortField &&
      VEHICLE_SORT_FIELDS.includes(
        query.sortField as (typeof VEHICLE_SORT_FIELDS)[number],
      )
        ? query.sortField
        : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: {
          unit: { select: { id: true, unitNumber: true, building: true } },
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, tenantId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async update(tenantId: string, id: string, dto: UpdateVehicleDto) {
    await this.findOne(tenantId, id);
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...(dto.plateNumber != null && { plateNumber: dto.plateNumber }),
        ...(dto.make !== undefined && { make: dto.make }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.year !== undefined && { year: dto.year }),
        ...(dto.ownerType !== undefined && { ownerType: dto.ownerType }),
        ...(dto.ownerId !== undefined && { ownerId: dto.ownerId }),
        ...(dto.unitId !== undefined && { unitId: dto.unitId || null }),
        ...(dto.tagId !== undefined && { tagId: dto.tagId }),
        ...(dto.stickerNumber !== undefined && {
          stickerNumber: dto.stickerNumber,
        }),
        ...(dto.parkingSpace !== undefined && {
          parkingSpace: dto.parkingSpace,
        }),
        ...(dto.isRestricted !== undefined && {
          isRestricted: dto.isRestricted,
        }),
        ...(dto.isPrimary !== undefined && { isPrimary: dto.isPrimary }),
        ...(dto.expiresAt !== undefined && {
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async updatePhoto(tenantId: string, id: string, photoUrl: string) {
    await this.findOne(tenantId, id);
    return this.prisma.vehicle.update({ where: { id }, data: { photoUrl } });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.vehicle.delete({ where: { id } });
  }

  async exportAll(tenantId: string, selectedIds?: string[]) {
    const where: any = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    return this.prisma.vehicle.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async bulkImport(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.plateNumber || !String(row.plateNumber).trim()) { result.errors.push({ row: i + 2, message: 'Missing required: Plate Number' }); continue; }
        if (row.plateNumber) {
          const existing = await this.prisma.vehicle.findFirst({ where: { tenantId, plateNumber: String(row.plateNumber) } });
          if (existing) { result.skipped++; result.errors.push({ row: i + 2, message: `Duplicate plate: ${row.plateNumber}` }); continue; }
        }
        const data: Record<string, unknown> = { tenantId, plateNumber: String(row.plateNumber ?? '') };
        if (row.make) data.make = String(row.make);
        if (row.model) data.model = String(row.model);
        if (row.color) data.color = String(row.color);
        if (row.year) data.year = parseInt(String(row.year), 10) || undefined;
        if (row.tagId) data.tagId = String(row.tagId);
        if (row.stickerNumber) data.stickerNumber = String(row.stickerNumber);
        if (row.parkingSpace) data.parkingSpace = String(row.parkingSpace);
        if (row.notes) data.notes = String(row.notes);
        await this.prisma.vehicle.create({ data: data as any });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }
}
