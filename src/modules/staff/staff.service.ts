import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateSafe } from '../../common/utils/parse-date';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';

export const STAFF_FIELD_MAPPING: FieldMapping[] = [
  { field: 'firstName', header: 'First Name', required: true },
  { field: 'lastName', header: 'Last Name', required: true },
  { field: 'email', header: 'Email' },
  { field: 'phone', header: 'Phone' },
  { field: 'employeeId', header: 'Employee ID' },
  { field: 'position', header: 'Position' },
  { field: 'department', header: 'Department' },
  { field: 'role', header: 'Role' },
  { field: 'assignedBuilding', header: 'Assigned Building' },
  { field: 'dateOfBirth', header: 'Date of Birth' },
  { field: 'hireDate', header: 'Hire Date' },
  { field: 'address', header: 'Address' },
  { field: 'notes', header: 'Notes' },
  { field: 'isActive', header: 'Active' },
];

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
    const [rows, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
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

  /* ─── Export / Import ─────────────────────────────────────────────── */

  async exportAll(
    tenantId: string,
    isActive?: boolean,
    selectedIds?: string[],
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (isActive !== undefined) where.isActive = isActive;
    if (selectedIds?.length) where.id = { in: selectedIds };
    return this.prisma.staff.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async bulkImport(
    tenantId: string,
    rows: Record<string, unknown>[],
  ): Promise<ImportResult> {
    const result: ImportResult = {
      total: rows.length,
      created: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const missing: string[] = [];
        if (!row.firstName || !String(row.firstName).trim()) missing.push('First Name');
        if (!row.lastName || !String(row.lastName).trim()) missing.push('Last Name');
        if (missing.length) { result.errors.push({ row: i + 2, message: `Missing required: ${missing.join(', ')}` }); continue; }
        // Duplicate check by email
        if (row.email) {
          const existing = await this.prisma.staff.findFirst({
            where: { tenantId, email: String(row.email) },
          });
          if (existing) {
            result.skipped++;
            result.errors.push({
              row: i + 2,
              message: `Duplicate email: ${row.email}`,
            });
            continue;
          }
        }
        // Duplicate check by employeeId
        if (row.employeeId) {
          const existing = await this.prisma.staff.findFirst({
            where: { tenantId, employeeId: String(row.employeeId) },
          });
          if (existing) {
            result.skipped++;
            result.errors.push({
              row: i + 2,
              message: `Duplicate employee ID: ${row.employeeId}`,
            });
            continue;
          }
        }

        const isActiveRaw = row.isActive !== undefined
          ? String(row.isActive).toLowerCase()
          : 'true';

        const data: Record<string, unknown> = {
          tenantId,
          firstName: String(row.firstName ?? ''),
          lastName: String(row.lastName ?? ''),
          isActive: isActiveRaw === 'true' || isActiveRaw === '1',
        };
        if (row.email) data.email = String(row.email);
        if (row.phone) data.phone = String(row.phone);
        if (row.department) data.department = String(row.department);
        if (row.role) data.role = String(row.role);
        if (row.employeeId) data.employeeId = String(row.employeeId);
        if (row.position) data.position = String(row.position);
        if (row.dateOfBirth) { const d = parseDateSafe(row.dateOfBirth); if (d) data.dateOfBirth = d; }
        if (row.hireDate) { const d = parseDateSafe(row.hireDate); if (d) data.hireDate = d; }
        if (row.assignedBuilding) data.assignedBuilding = String(row.assignedBuilding);
        if (row.address) data.address = String(row.address);
        if (row.notes) data.notes = String(row.notes);

        await this.prisma.staff.create({ data: data as any });
        result.created++;
      } catch (e) {
        result.errors.push({
          row: i + 2,
          message: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    }

    return result;
  }
}
