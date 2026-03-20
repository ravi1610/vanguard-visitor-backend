import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { applyFilters } from '../../common/utils/filter-utils';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

const DEPARTMENT_SORT_FIELDS = ['name', 'isActive', 'createdAt'] as const;

@Injectable()
export class DepartmentService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto) {
    return this.prisma.department.create({
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
    if (search) {
      where.OR = [{ name: { contains: search, mode: 'insensitive' } }];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField =
      query.sortField && DEPARTMENT_SORT_FIELDS.includes(query.sortField as (typeof DEPARTMENT_SORT_FIELDS)[number])
        ? query.sortField
        : 'name';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.department.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOne(id);
    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.isActive != null && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.department.delete({ where: { id } });
  }
}
