import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateStaffPositionDto } from './dto/create-staff-position.dto';
import { UpdateStaffPositionDto } from './dto/update-staff-position.dto';

const STAFF_POSITION_SORT_FIELDS = ['name', 'isActive', 'createdAt'] as const;

@Injectable()
export class StaffPositionService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateStaffPositionDto) {
    return this.prisma.staffPosition.create({
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
      query.sortField && STAFF_POSITION_SORT_FIELDS.includes(query.sortField as (typeof STAFF_POSITION_SORT_FIELDS)[number])
        ? query.sortField
        : 'name';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.staffPosition.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.staffPosition.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(id: string) {
    const position = await this.prisma.staffPosition.findUnique({
      where: { id },
    });
    if (!position) throw new NotFoundException('Staff position not found');
    return position;
  }

  async update(id: string, dto: UpdateStaffPositionDto) {
    await this.findOne(id);
    return this.prisma.staffPosition.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.isActive != null && { isActive: dto.isActive }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.staffPosition.delete({ where: { id } });
  }
}
