import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateComplianceItemDto } from './dto/create-compliance.dto';
import { UpdateComplianceItemDto } from './dto/update-compliance.dto';

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
      status?: 'pending' | 'completed' | 'overdue';
      OR?: object[];
    } = { tenantId };
    if (status) where.status = status as 'pending' | 'completed' | 'overdue';
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
}
