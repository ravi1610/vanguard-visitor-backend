import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';

export const VISITOR_FIELD_MAPPING: FieldMapping[] = [
  { field: 'firstName', header: 'First Name', required: true },
  { field: 'lastName', header: 'Last Name', required: true },
  { field: 'email', header: 'Email' },
  { field: 'phone', header: 'Phone' },
  { field: 'company', header: 'Company' },
  { field: 'documentId', header: 'Document ID' },
  { field: 'notes', header: 'Notes' },
];

const VISITOR_SORT_FIELDS = ['firstName', 'lastName', 'email', 'company', 'createdAt'] as const;

@Injectable()
export class VisitorsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateVisitorDto) {
    return this.prisma.visitor.create({
      data: {
        tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        company: dto.company,
        documentId: dto.documentId,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto) {
    const where: { tenantId: string; OR?: object[] } = { tenantId };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
        { documentId: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && VISITOR_SORT_FIELDS.includes(query.sortField as (typeof VISITOR_SORT_FIELDS)[number]) ? query.sortField : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.visitor.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: { _count: { select: { visits: true } } },
      }),
      this.prisma.visitor.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const visitor = await this.prisma.visitor.findFirst({
      where: { id, tenantId },
      include: { visits: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!visitor) throw new NotFoundException('Visitor not found');
    return visitor;
  }

  async update(tenantId: string, id: string, dto: UpdateVisitorDto) {
    await this.findOne(tenantId, id);
    return this.prisma.visitor.update({
      where: { id },
      data: {
        ...(dto.firstName != null && { firstName: dto.firstName }),
        ...(dto.lastName != null && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.documentId !== undefined && { documentId: dto.documentId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  /* ─── Export / Import ─────────────────────────────────────────────── */

  async exportAll(tenantId: string, selectedIds?: string[]) {
    const where: Record<string, unknown> = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    return this.prisma.visitor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async bulkImport(
    tenantId: string,
    rows: Record<string, unknown>[],
  ): Promise<ImportResult> {
    const result: ImportResult = {
      total: rows.length,
      created: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const missing: string[] = [];
        if (!row.firstName || !String(row.firstName).trim()) missing.push('First Name');
        if (!row.lastName || !String(row.lastName).trim()) missing.push('Last Name');
        if (missing.length) { result.errors.push({ row: i + 2, message: `Missing required: ${missing.join(', ')}` }); continue; }
        // Duplicate check: same first+last+email within tenant
        if (row.email) {
          const existing = await this.prisma.visitor.findFirst({
            where: {
              tenantId,
              email: String(row.email),
              firstName: String(row.firstName ?? ''),
              lastName: String(row.lastName ?? ''),
            },
          });
          if (existing) {
            result.skipped++;
            result.errors.push({
              row: i + 2,
              message: `Duplicate visitor: ${row.firstName} ${row.lastName} (${row.email})`,
            });
            continue;
          }
        }

        const data: Record<string, unknown> = {
          tenantId,
          firstName: String(row.firstName ?? ''),
          lastName: String(row.lastName ?? ''),
        };
        if (row.email) data.email = String(row.email);
        if (row.phone) data.phone = String(row.phone);
        if (row.company) data.company = String(row.company);
        if (row.documentId) data.documentId = String(row.documentId);
        if (row.notes) data.notes = String(row.notes);

        await this.prisma.visitor.create({ data: data as any });
        result.created++;
      } catch (e) {
        result.errors.push({
          row: i + 2,
          message: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    return result;
  }
}
