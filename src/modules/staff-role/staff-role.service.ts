import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { applyFilters } from '../../common/utils/filter-utils';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateStaffRoleDto } from './dto/create-staff-role.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';

export const STAFF_ROLE_FIELD_MAPPING: FieldMapping[] = [
  { field: 'name', header: 'Name', required: true },
  { field: 'isActive', header: 'Active' },
];

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
    applyFilters(where, query.filters);
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

  async exportAll(isActive?: boolean) {
    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive;
    return this.prisma.staffRole.findMany({ where, orderBy: { name: 'asc' } });
  }

  async bulkImport(rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const name = String(row.name ?? '').trim();
        if (!name) { result.errors.push({ row: i + 2, message: 'Missing required: Name' }); continue; }
        const existing = await this.prisma.staffRole.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
        if (existing) { result.skipped++; continue; }
        const isActive = row.isActive === undefined || row.isActive === '' ? true : String(row.isActive).toLowerCase() === 'true';
        await this.prisma.staffRole.create({ data: { name, isActive } });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }
}
