import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

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
}
