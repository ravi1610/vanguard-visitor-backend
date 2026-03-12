import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

const STAFF_SORT_FIELDS = [
  'firstName', 'lastName', 'email', 'department', 'position', 'hireDate', 'createdAt',
] as const;

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateStaffDto) {
    return this.prisma.staff.create({
      data: {
        tenantId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        departmentId: dto.department || undefined,
        roleId: dto.role || undefined,
        employeeId: dto.employeeId,
        positionId: dto.position || undefined,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        assignedBuilding: dto.assignedBuilding,
        address: dto.address,
        notes: dto.notes,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto, isActive?: boolean) {
    const where: { tenantId: string; isActive?: boolean; OR?: object[] } = { tenantId };
    if (isActive !== undefined) where.isActive = isActive;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { department: { name: { contains: search, mode: 'insensitive' } } },
        { position: { name: { contains: search, mode: 'insensitive' } } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { assignedBuilding: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && STAFF_SORT_FIELDS.includes(query.sortField as (typeof STAFF_SORT_FIELDS)[number]) ? query.sortField : 'createdAt';
    const sortDir: 'asc' | 'desc' = query.sortDir === 'asc' ? 'asc' : 'desc';
    const orderBy =
      sortField === 'position'
        ? { position: { name: sortDir } }
        : sortField === 'department'
          ? { department: { name: sortDir } }
          : { [sortField]: sortDir };
    const [rawRows, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          position: true,
          department: true,
          role: true,
        },
      }),
      this.prisma.staff.count({ where }),
    ]);
    const rows = rawRows.map((row) => ({
      ...row,
      position: row.position?.name ?? null,
      department: row.department?.name ?? null,
      role: row.role?.name ?? null,
    }));
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, tenantId },
    });
    if (!staff) throw new NotFoundException('Staff not found');
    return staff;
  }

  async update(tenantId: string, id: string, dto: UpdateStaffDto) {
    await this.findOne(tenantId, id);
    const data: Parameters<PrismaService['staff']['update']>[0]['data'] = {
      ...(dto.firstName != null && { firstName: dto.firstName }),
      ...(dto.lastName != null && { lastName: dto.lastName }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.employeeId !== undefined && { employeeId: dto.employeeId }),
      ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
      ...(dto.hireDate !== undefined && { hireDate: dto.hireDate ? new Date(dto.hireDate) : null }),
      ...(dto.assignedBuilding !== undefined && { assignedBuilding: dto.assignedBuilding }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.isActive != null && { isActive: dto.isActive }),
    };
    if (dto.role !== undefined) {
      data.role = dto.role ? { connect: { id: dto.role } } : { disconnect: true };
    }
    if (dto.position !== undefined) {
      data.position = dto.position ? { connect: { id: dto.position } } : { disconnect: true };
    }
    if (dto.department !== undefined) {
      data.department = dto.department ? { connect: { id: dto.department } } : { disconnect: true };
    }
    return this.prisma.staff.update({ where: { id }, data });
  }

  async updatePhoto(tenantId: string, id: string, photoUrl: string) {
    await this.findOne(tenantId, id);
    return this.prisma.staff.update({
      where: { id },
      data: { photoUrl },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.staff.delete({ where: { id } });
  }
}
