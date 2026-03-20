import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateSafe } from '../../common/utils/parse-date';
import { applyFilters, equals } from '../../common/utils/filter-utils';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateComplianceItemDto } from './dto/create-compliance.dto';
import { UpdateComplianceItemDto } from './dto/update-compliance.dto';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';

export const COMPLIANCE_FIELD_MAPPING: FieldMapping[] = [
  { field: 'name', header: 'Name', required: true },
  { field: 'dueDate', header: 'Due Date' },
  { field: 'status', header: 'Status' },
  { field: 'category', header: 'Category' },
  { field: 'notes', header: 'Notes' },
];

const COMPLIANCE_SORT_FIELDS = ['name', 'dueDate', 'status', 'category'] as const;

@Injectable()
export class ComplianceService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateComplianceItemDto) {
    return this.prisma.complianceItem.create({
      data: {
        tenantId,
        name: dto.name,
        dueDate: new Date(dto.dueDate),
        status: dto.status ?? 'pending',
        category: dto.category,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto, status?: string) {
    const where: {
      tenantId: string;
      status?: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'compliant';
      OR?: object[];
    } = { tenantId };
    if (status) where.status = status as 'pending' | 'in_progress' | 'completed' | 'overdue' | 'compliant';
    applyFilters(where, query.filters, { status: equals('status') });
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && COMPLIANCE_SORT_FIELDS.includes(query.sortField as (typeof COMPLIANCE_SORT_FIELDS)[number]) ? query.sortField : 'dueDate';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.complianceItem.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.complianceItem.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const item = await this.prisma.complianceItem.findFirst({
      where: { id, tenantId },
    });
    if (!item) throw new NotFoundException('Compliance item not found');
    return item;
  }

  async update(tenantId: string, id: string, dto: UpdateComplianceItemDto) {
    await this.findOne(tenantId, id);
    return this.prisma.complianceItem.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.dueDate != null && { dueDate: new Date(dto.dueDate) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.complianceItem.delete({ where: { id } });
  }

  /* ─── Import / Export ──────────────────────────────────────────── */

  async exportAll(tenantId: string, selectedIds?: string[], status?: string) {
    const where: any = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    if (status) where.status = status;
    return this.prisma.complianceItem.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async bulkImport(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name || !String(row.name).trim()) { result.errors.push({ row: i + 2, message: 'Missing required: Name' }); continue; }
        const existing = await this.prisma.complianceItem.findFirst({ where: { tenantId, name: String(row.name) } });
        if (existing) { result.skipped++; result.errors.push({ row: i + 2, message: `Duplicate compliance item: ${row.name}` }); continue; }
        const data: Record<string, unknown> = { tenantId, name: String(row.name ?? '') };
        if (row.dueDate) { const d = parseDateSafe(row.dueDate); if (d) data.dueDate = d; }
        if (row.status) data.status = String(row.status);
        if (row.category) data.category = String(row.category);
        if (row.notes) data.notes = String(row.notes);
        await this.prisma.complianceItem.create({ data: data as any });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }
}
