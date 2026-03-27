import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { applyFilters } from '../../common/utils/filter-utils';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateComplianceCategoryDto } from './dto/create-compliance-category.dto';
import { UpdateComplianceCategoryDto } from './dto/update-compliance-category.dto';

const COMPLIANCE_CATEGORY_SORT_FIELDS = ['name', 'isActive', 'createdAt'] as const;

@Injectable()
export class ComplianceCategoryService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateComplianceCategoryDto) {
    return this.prisma.complianceCategory.create({
      data: {
        name: dto.name,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(query: PagedQueryDto, isActive?: boolean) {
    const where: { isActive?: boolean; OR?: object[] } = {};
    if (isActive !== undefined) where.isActive = isActive;
    applyFilters(where, query.filters);
    const search = query.search?.trim();
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }];

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField =
      query.sortField && COMPLIANCE_CATEGORY_SORT_FIELDS.includes(query.sortField as (typeof COMPLIANCE_CATEGORY_SORT_FIELDS)[number])
        ? query.sortField
        : 'name';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.complianceCategory.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.complianceCategory.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(id: string) {
    const category = await this.prisma.complianceCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Compliance category not found');
    return category;
  }

  async update(id: string, dto: UpdateComplianceCategoryDto) {
    await this.findOne(id);
    return this.prisma.complianceCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.complianceCategory.delete({ where: { id } });
  }
}
