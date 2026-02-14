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
        department: dto.department,
        role: dto.role,
        employeeId: dto.employeeId,
        position: dto.position,
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
        { department: { contains: search, mode: 'insensitive' } },
        { position: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { assignedBuilding: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && STAFF_SORT_FIELDS.includes(query.sortField as (typeof STAFF_SORT_FIELDS)[number]) ? query.sortField : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.staff.count({ where }),
    ]);
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
    return this.prisma.staff.update({
      where: { id },
      data: {
        ...(dto.firstName != null && { firstName: dto.firstName }),
        ...(dto.lastName != null && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.employeeId !== undefined && { employeeId: dto.employeeId }),
        ...(dto.position !== undefined && { position: dto.position }),
        ...(dto.dateOfBirth !== undefined && { dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
        ...(dto.hireDate !== undefined && { hireDate: dto.hireDate ? new Date(dto.hireDate) : null }),
        ...(dto.assignedBuilding !== undefined && { assignedBuilding: dto.assignedBuilding }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isActive != null && { isActive: dto.isActive }),
      },
    });
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
