import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';

export const DOCUMENT_FIELD_MAPPING: FieldMapping[] = [
  { field: 'name', header: 'Name', required: true },
  { field: 'documentType', header: 'Document Type' },
  { field: 'category', header: 'Category' },
  { field: 'fileUrl', header: 'File URL' },
];

const DOC_SORT_FIELDS = ['name', 'documentType', 'category', 'createdAt'] as const;

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateDocumentDto, userId?: string) {
    return this.prisma.document.create({
      data: {
        tenantId,
        name: dto.name,
        documentType: dto.documentType,
        category: dto.category,
        fileUrl: dto.fileUrl,
        uploadedByUserId: dto.uploadedByUserId ?? userId,
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto, uploadedByUserId?: string) {
    const where: { tenantId: string; uploadedByUserId?: string; OR?: object[] } = { tenantId };
    if (uploadedByUserId) where.uploadedByUserId = uploadedByUserId;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { documentType: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && DOC_SORT_FIELDS.includes(query.sortField as (typeof DOC_SORT_FIELDS)[number]) ? query.sortField : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: { uploadedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.document.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async update(tenantId: string, id: string, dto: UpdateDocumentDto) {
    await this.findOne(tenantId, id);
    return this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.documentType !== undefined && {
          documentType: dto.documentType,
        }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.fileUrl !== undefined && { fileUrl: dto.fileUrl }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.document.delete({ where: { id } });
  }

  async exportAll(tenantId: string, selectedIds?: string[]) {
    const where: any = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    return this.prisma.document.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async bulkImport(tenantId: string, rows: Record<string, unknown>[], userId?: string): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name || !String(row.name).trim()) { result.errors.push({ row: i + 2, message: 'Missing required: Name' }); continue; }
        const existing = await this.prisma.document.findFirst({ where: { tenantId, name: String(row.name) } });
        if (existing) { result.skipped++; result.errors.push({ row: i + 2, message: `Duplicate document: ${row.name}` }); continue; }
        const data: Record<string, unknown> = { tenantId, name: String(row.name ?? '') };
        if (row.documentType) data.documentType = String(row.documentType);
        if (row.category) data.category = String(row.category);
        if (row.fileUrl) data.fileUrl = String(row.fileUrl);
        if (userId) data.uploadedByUserId = userId;
        await this.prisma.document.create({ data: data as any });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }
}
