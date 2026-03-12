import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';

export const VENDOR_FIELD_MAPPING: FieldMapping[] = [
  { field: 'name', header: 'Name', required: true },
  { field: 'contactName', header: 'Contact Name' },
  { field: 'email', header: 'Email' },
  { field: 'phone', header: 'Phone' },
  { field: 'category', header: 'Category' },
  { field: 'notes', header: 'Notes' },
];

const VENDOR_SORT_FIELDS = ['name', 'contactName', 'email', 'category', 'createdAt'] as const;

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateVendorDto) {
    return this.prisma.vendor.create({
      data: {
        tenantId,
        name: dto.name,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        category: dto.category,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto) {
    const where: { tenantId: string; OR?: object[] } = { tenantId };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && VENDOR_SORT_FIELDS.includes(query.sortField as (typeof VENDOR_SORT_FIELDS)[number]) ? query.sortField : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.vendor.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, tenantId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async update(tenantId: string, id: string, dto: UpdateVendorDto) {
    await this.findOne(tenantId, id);
    return this.prisma.vendor.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.vendor.delete({ where: { id } });
  }

  /* ─── Import / Export ──────────────────────────────────────────── */

  async exportAll(tenantId: string, selectedIds?: string[]) {
    const where: any = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    return this.prisma.vendor.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async bulkImport(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name || !String(row.name).trim()) { result.errors.push({ row: i + 2, message: 'Missing required: Name' }); continue; }
        const existing = await this.prisma.vendor.findFirst({ where: { tenantId, name: String(row.name) } });
        if (existing) { result.skipped++; result.errors.push({ row: i + 2, message: `Duplicate vendor: ${row.name}` }); continue; }
        const data: Record<string, unknown> = { tenantId, name: String(row.name ?? '') };
        if (row.contactName) data.contactName = String(row.contactName);
        if (row.email) data.email = String(row.email);
        if (row.phone) data.phone = String(row.phone);
        if (row.category) data.category = String(row.category);
        if (row.notes) data.notes = String(row.notes);
        await this.prisma.vendor.create({ data: data as any });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }
}
