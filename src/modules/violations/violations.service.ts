import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateViolationDto } from './dto/create-violation.dto';
import { UpdateViolationDto } from './dto/update-violation.dto';

const SORT_FIELDS = ['title', 'status', 'issuedDate', 'createdAt'] as const;

@Injectable()
export class ViolationsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateViolationDto) {
    return this.prisma.violation.create({
      data: {
        tenantId,
        userId: dto.userId,
        title: dto.title,
        description: dto.description,
        type: dto.type ?? 'other',
        status: dto.status ?? 'open',
        fineAmount: dto.fineAmount,
        issuedDate: new Date(dto.issuedDate),
        resolvedDate: dto.resolvedDate ? new Date(dto.resolvedDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto, userId?: string, status?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (userId) where.userId = userId;
    if (status) where.status = status;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField =
      query.sortField &&
      SORT_FIELDS.includes(query.sortField as (typeof SORT_FIELDS)[number])
        ? query.sortField
        : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.violation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.violation.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.violation.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Violation not found');
    return record;
  }

  async update(tenantId: string, id: string, dto: UpdateViolationDto) {
    await this.findOne(tenantId, id);
    return this.prisma.violation.update({
      where: { id },
      data: {
        ...(dto.title != null && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.fineAmount !== undefined && { fineAmount: dto.fineAmount }),
        ...(dto.issuedDate !== undefined && { issuedDate: new Date(dto.issuedDate) }),
        ...(dto.resolvedDate !== undefined && {
          resolvedDate: dto.resolvedDate ? new Date(dto.resolvedDate) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.violation.delete({ where: { id } });
  }
}
