import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateSafe } from '../../common/utils/parse-date';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { CreateSpaceAssignmentDto } from './dto/create-space-assignment.dto';
import { UpdateSpaceAssignmentDto } from './dto/update-space-assignment.dto';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';

export const SPACE_FIELD_MAPPING: FieldMapping[] = [
  { field: 'name', header: 'Name', required: true },
  { field: 'type', header: 'Type' },
];

export const SPACE_ASSIGNMENT_FIELD_MAPPING: FieldMapping[] = [
  { field: 'spaceName', header: 'Space Name', required: true },
  { field: 'assigneeType', header: 'Assignee Type', required: true },
  { field: 'assigneeId', header: 'Assignee ID', required: true },
  { field: 'fromDate', header: 'From Date', required: true },
  { field: 'toDate', header: 'To Date', required: true },
];

const ASSIGNMENT_SORT_FIELDS = ['fromDate', 'toDate', 'assigneeType'] as const;

@Injectable()
export class SpacesService {
  constructor(private prisma: PrismaService) {}

  async createSpace(tenantId: string, dto: CreateSpaceDto) {
    return this.prisma.space.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type ?? 'parking',
      },
    });
  }

  async findAllSpaces(tenantId: string, query?: PagedQueryDto) {
    if (!query?.page && !query?.pageSize) {
      return this.prisma.space.findMany({
        where: { tenantId },
        include: { assignments: true },
        orderBy: [{ name: 'asc' }],
      });
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = (query.sortField === 'name' || query.sortField === 'type') ? query.sortField : 'name';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const where: { tenantId: string; OR?: object[] } = { tenantId };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.space.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: { _count: { select: { assignments: true } } },
      }),
      this.prisma.space.count({ where }),
    ]);
    return { rows, total };
  }

  async findOneSpace(tenantId: string, id: string) {
    const space = await this.prisma.space.findFirst({
      where: { id, tenantId },
      include: { assignments: true },
    });
    if (!space) throw new NotFoundException('Space not found');
    return space;
  }

  async updateSpace(tenantId: string, id: string, dto: UpdateSpaceDto) {
    await this.findOneSpace(tenantId, id);
    return this.prisma.space.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
      },
    });
  }

  async removeSpace(tenantId: string, id: string) {
    await this.findOneSpace(tenantId, id);
    return this.prisma.space.delete({ where: { id } });
  }

  async createAssignment(tenantId: string, dto: CreateSpaceAssignmentDto) {
    const space = await this.prisma.space.findFirst({
      where: { id: dto.spaceId, tenantId },
    });
    if (!space) throw new NotFoundException('Space not found');
    return this.prisma.spaceAssignment.create({
      data: {
        tenantId,
        spaceId: dto.spaceId,
        assigneeType: dto.assigneeType,
        assigneeId: dto.assigneeId,
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
      },
    });
  }

  async findAllAssignments(tenantId: string, query: PagedQueryDto, spaceId?: string, assigneeId?: string) {
    const where: { tenantId: string; spaceId?: string; assigneeId?: string } = { tenantId };
    if (spaceId) where.spaceId = spaceId;
    if (assigneeId) where.assigneeId = assigneeId;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && ASSIGNMENT_SORT_FIELDS.includes(query.sortField as (typeof ASSIGNMENT_SORT_FIELDS)[number]) ? query.sortField : 'fromDate';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.spaceAssignment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: { space: true },
      }),
      this.prisma.spaceAssignment.count({ where }),
    ]);
    return { rows, total };
  }

  async findOneAssignment(tenantId: string, id: string) {
    const a = await this.prisma.spaceAssignment.findFirst({
      where: { id, tenantId },
      include: { space: true },
    });
    if (!a) throw new NotFoundException('Assignment not found');
    return a;
  }

  async updateAssignment(
    tenantId: string,
    id: string,
    dto: UpdateSpaceAssignmentDto,
  ) {
    await this.findOneAssignment(tenantId, id);
    return this.prisma.spaceAssignment.update({
      where: { id },
      data: {
        ...(dto.spaceId != null && { spaceId: dto.spaceId }),
        ...(dto.assigneeType != null && { assigneeType: dto.assigneeType }),
        ...(dto.assigneeId != null && { assigneeId: dto.assigneeId }),
        ...(dto.fromDate != null && { fromDate: new Date(dto.fromDate) }),
        ...(dto.toDate != null && { toDate: new Date(dto.toDate) }),
      },
    });
  }

  async removeAssignment(tenantId: string, id: string) {
    await this.findOneAssignment(tenantId, id);
    return this.prisma.spaceAssignment.delete({ where: { id } });
  }

  async exportAllSpaces(tenantId: string, selectedIds?: string[]) {
    const where: any = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    return this.prisma.space.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async bulkImportSpaces(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name || !String(row.name).trim()) { result.errors.push({ row: i + 2, message: 'Missing required: Name' }); continue; }
        const existing = await this.prisma.space.findFirst({ where: { tenantId, name: String(row.name) } });
        if (existing) { result.skipped++; result.errors.push({ row: i + 2, message: `Duplicate space: ${row.name}` }); continue; }
        const data: Record<string, unknown> = { tenantId, name: String(row.name ?? '') };
        if (row.type) data.type = String(row.type);
        await this.prisma.space.create({ data: data as any });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }

  async exportAllAssignments(tenantId: string, selectedIds?: string[]) {
    const where: any = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    const rows = await this.prisma.spaceAssignment.findMany({ where, include: { space: true }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({
      spaceName: (r as any).space?.name ?? '',
      assigneeType: r.assigneeType,
      assigneeId: r.assigneeId,
      fromDate: r.fromDate ? new Date(r.fromDate).toISOString().slice(0, 10) : '',
      toDate: r.toDate ? new Date(r.toDate).toISOString().slice(0, 10) : '',
    }));
  }

  async bulkImportAssignments(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const spaceName = String(row.spaceName ?? '').trim();
        if (!spaceName) { result.errors.push({ row: i + 2, message: 'Space Name is required' }); continue; }
        const space = await this.prisma.space.findFirst({ where: { tenantId, name: spaceName } });
        if (!space) { result.errors.push({ row: i + 2, message: `Space not found: ${spaceName}` }); continue; }
        await this.prisma.spaceAssignment.create({
          data: {
            tenantId,
            spaceId: space.id,
            assigneeType: String(row.assigneeType ?? ''),
            assigneeId: String(row.assigneeId ?? ''),
            fromDate: parseDateSafe(row.fromDate) ?? new Date(),
            toDate: parseDateSafe(row.toDate) ?? new Date(),
          },
        });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }
}
