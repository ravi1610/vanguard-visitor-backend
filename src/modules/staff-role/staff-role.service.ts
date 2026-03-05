import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateStaffRoleDto } from './dto/create-staff-role.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';

const STAFF_ROLE_SORT_FIELDS = ['name', 'isActive', 'createdAt'] as const;

@Injectable()
export class StaffRoleService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateStaffRoleDto) {
    return this.prisma.staffRole.create({
      data: {
        name: dto.name,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(query: PagedQueryDto, isActive?: boolean) {
    const where: { isActive?: boolean; OR?: object[] } = {};
    if (isActive !== undefined) where.isActive = isActive;
    const search = query.search?.trim();
    if (search) {
      where.OR = [{ name: { contains: search, mode: 'insensitive' } }];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField =
      query.sortField && STAFF_ROLE_SORT_FIELDS.includes(query.sortField as (typeof STAFF_ROLE_SORT_FIELDS)[number])
        ? query.sortField
        : 'name';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.staffRole.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.staffRole.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(id: string) {
    const role = await this.prisma.staffRole.findUnique({
      where: { id },
    });
    if (!role) throw new NotFoundException('Staff role not found');
    return role;
  }

  async update(id: string, dto: UpdateStaffRoleDto) {
    await this.findOne(id);
    return this.prisma.staffRole.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.isActive != null && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.staffRole.delete({ where: { id } });
  }
}
