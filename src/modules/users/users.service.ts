import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateSafe } from '../../common/utils/parse-date';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';
import { applyFilters, containsInsensitive } from '../../common/utils/filter-utils';

export const USER_FIELD_MAPPING: FieldMapping[] = [
  { field: 'email', header: 'Email', required: true },
  { field: 'firstName', header: 'First Name', required: true },
  { field: 'lastName', header: 'Last Name', required: true },
  { field: 'phone', header: 'Phone' },
  { field: 'mobile', header: 'Mobile' },
  { field: 'residentType', header: 'Resident Type' },
  { field: 'dateOfBirth', header: 'Date of Birth' },
  { field: 'leaseBeginDate', header: 'Lease Begin Date' },
  { field: 'leaseEndDate', header: 'Lease End Date' },
  { field: 'note', header: 'Note' },
  { field: 'isActive', header: 'Active' },
];

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateUserDto) {
    const roleKey = dto.roleKey ?? 'receptionist';
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { tenantId, email },
    });
    if (existing)
      throw new ConflictException('User with this email already exists');

    const role = await this.prisma.role.findFirst({
      where: { tenantId, key: roleKey },
    });
    if (!role) throw new NotFoundException(`Role ${roleKey} not found`);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: dto.isActive ?? true,
        ...(dto.residentType != null && { residentType: dto.residentType }),
        ...(dto.movingDate != null && { movingDate: new Date(dto.movingDate) }),
        ...(dto.isHandicapped != null && { isHandicapped: dto.isHandicapped }),
        ...(dto.isBoardMember != null && { isBoardMember: dto.isBoardMember }),
        ...(dto.optInElectronicCommunications != null && { optInElectronicCommunications: dto.optInElectronicCommunications }),
        ...(dto.otherContactInfo != null && { otherContactInfo: dto.otherContactInfo }),
        ...(dto.workInfo != null && { workInfo: dto.workInfo }),
        ...(dto.note != null && { note: dto.note }),
        ...(dto.photoUrl != null && { photoUrl: dto.photoUrl }),
        ...(dto.unitId != null && { unitId: dto.unitId }),
        ...(dto.phone != null && { phone: dto.phone }),
        ...(dto.mobile != null && { mobile: dto.mobile }),
        ...(dto.dateOfBirth != null && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.leaseBeginDate != null && { leaseBeginDate: new Date(dto.leaseBeginDate) }),
        ...(dto.leaseEndDate != null && { leaseEndDate: new Date(dto.leaseEndDate) }),
        userRoles: {
          create: { roleId: role.id },
        },
      },
      include: {
        userRoles: { include: { role: true } },
      },
    });
    return this.omitPassword(user);
  }

  async findAll(
    tenantId: string,
    requesterRoles: string[] | undefined,
    roleKey: string | undefined,
    query: PagedQueryDto,
    isActive?: boolean,
    isBoardMember?: boolean,
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (roleKey) {
      where.userRoles = { some: { role: { key: roleKey } } };
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (isBoardMember !== undefined) {
      where.isBoardMember = isBoardMember;
    }
    const isTenantOwner = (requesterRoles ?? []).includes('tenant_owner');
    if (!isTenantOwner) {
      where.isSuperAdmin = false;
      where.AND = [
        ...(Array.isArray(where.AND) ? (where.AND as Record<string, unknown>[]) : []),
        { userRoles: { none: { role: { key: 'tenant_owner' } } } },
      ];
    }
    applyFilters(where, query.filters, {
      firstName: containsInsensitive('firstName'),
      lastName: containsInsensitive('lastName'),
      email: containsInsensitive('email'),
      phone: containsInsensitive('phone'),
      mobile: containsInsensitive('mobile'),
      residentType: containsInsensitive('residentType'),
    });

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { unit: { unitNumber: { contains: search, mode: 'insensitive' } } },
        { phone: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const sortField = query.sortField && ['firstName', 'lastName', 'email', 'residentType', 'createdAt', 'leaseBeginDate', 'leaseEndDate'].includes(query.sortField)
      ? query.sortField
      : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { [sortField]: sortDir },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          residentType: true,
          movingDate: true,
          isHandicapped: true,
          isBoardMember: true,
          optInElectronicCommunications: true,
          otherContactInfo: true,
          workInfo: true,
          note: true,
          photoUrl: true,
          unitId: true,
          unit: { select: { id: true, unitNumber: true, building: true } },
          phone: true,
          mobile: true,
          dateOfBirth: true,
          leaseBeginDate: true,
          leaseEndDate: true,
          userRoles: { include: { role: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, tenantId },
      include: {
        userRoles: { include: { role: true } },
        unit: { select: { id: true, unitNumber: true, building: true } },
        _count: {
          select: {
            hostedVisits: true,
            maintenanceAssigned: true,
            tasksAssigned: true,
            documentsUploaded: true,
            emergencyContacts: true,
            pets: true,
            violations: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.omitPassword(user);
  }

  async update(tenantId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(tenantId, id);
    const data: Record<string, unknown> = {};
    if (dto.firstName != null) data.firstName = dto.firstName;
    if (dto.lastName != null) data.lastName = dto.lastName;
    if (dto.isActive != null) data.isActive = dto.isActive;
    if (dto.residentType !== undefined) data.residentType = (!dto.residentType) ? null : dto.residentType;
    if (dto.password != null)
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    if (dto.movingDate !== undefined) data.movingDate = dto.movingDate ? new Date(dto.movingDate) : null;
    if (dto.isHandicapped != null) data.isHandicapped = dto.isHandicapped;
    if (dto.isBoardMember != null) data.isBoardMember = dto.isBoardMember;
    if (dto.optInElectronicCommunications != null) data.optInElectronicCommunications = dto.optInElectronicCommunications;
    if (dto.otherContactInfo !== undefined) data.otherContactInfo = dto.otherContactInfo;
    if (dto.workInfo !== undefined) data.workInfo = dto.workInfo;
    if (dto.note !== undefined) data.note = dto.note;
    if (dto.photoUrl !== undefined) data.photoUrl = dto.photoUrl;
    if (dto.unitId !== undefined) data.unitId = dto.unitId || null;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.mobile !== undefined) data.mobile = dto.mobile || null;
    if (dto.dateOfBirth !== undefined) data.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    if (dto.leaseBeginDate !== undefined) data.leaseBeginDate = dto.leaseBeginDate ? new Date(dto.leaseBeginDate) : null;
    if (dto.leaseEndDate !== undefined) data.leaseEndDate = dto.leaseEndDate ? new Date(dto.leaseEndDate) : null;

    if (dto.roleKey != null) {
      const role = await this.prisma.role.findFirst({
        where: { tenantId, key: dto.roleKey },
      });
      if (!role) throw new NotFoundException(`Role ${dto.roleKey} not found`);
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id }, data }),
        this.prisma.userRole.deleteMany({ where: { userId: id } }),
        this.prisma.userRole.create({ data: { userId: id, roleId: role.id } }),
      ]);
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: { userRoles: { include: { role: true } } },
      });
      return this.omitPassword(user!);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: { userRoles: { include: { role: true } } },
    });
    return this.omitPassword(user);
  }

  async updatePhoto(tenantId: string, id: string, photoUrl: string) {
    await this.findOne(tenantId, id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { photoUrl },
      include: {
        userRoles: { include: { role: true } },
        _count: {
          select: {
            hostedVisits: true,
            maintenanceAssigned: true,
            tasksAssigned: true,
            documentsUploaded: true,
            emergencyContacts: true,
            pets: true,
            violations: true,
          },
        },
      },
    });
    return this.omitPassword(user);
  }

  async assignRole(tenantId: string, userId: string, roleId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, tenantId } }),
      this.prisma.role.findFirst({ where: { id: roleId, tenantId } }),
    ]);
    if (!user) throw new NotFoundException('User not found');
    if (!role) throw new NotFoundException('Role not found');

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      create: { userId, roleId },
      update: {},
    });
    return this.findOne(tenantId, userId);
  }

  async remove(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }

  private omitPassword(user: { passwordHash?: string; [k: string]: unknown }) {
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  async exportAll(tenantId: string, selectedIds?: string[], isActive?: boolean, isBoardMember?: boolean, roleKey?: string) {
    const where: any = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    if (isActive !== undefined) where.isActive = isActive;
    if (isBoardMember !== undefined) where.isBoardMember = isBoardMember;
    if (roleKey) where.userRoles = { some: { role: { key: roleKey } } };
    // Exclude super-admin / admin users by default
    if (!where.userRoles) where.userRoles = { none: { role: { key: 'admin' } } };
    const users = await this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } });
    return users.map((u) => this.omitPassword(u));
  }

  async bulkImport(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const missing: string[] = [];
        if (!row.email || !String(row.email).trim()) missing.push('Email');
        if (!row.firstName || !String(row.firstName).trim()) missing.push('First Name');
        if (!row.lastName || !String(row.lastName).trim()) missing.push('Last Name');
        if (missing.length) { result.errors.push({ row: i + 2, message: `Missing required: ${missing.join(', ')}` }); continue; }
        if (row.email) {
          const existing = await this.prisma.user.findFirst({ where: { tenantId, email: String(row.email) } });
          if (existing) { result.skipped++; result.errors.push({ row: i + 2, message: `Duplicate email: ${row.email}` }); continue; }
        }
        const isActiveRaw = row.isActive !== undefined ? String(row.isActive).toLowerCase() : 'true';
        const data: Record<string, unknown> = {
          tenantId,
          email: String(row.email ?? ''),
          firstName: String(row.firstName ?? ''),
          lastName: String(row.lastName ?? ''),
          passwordHash: await require('bcrypt').hash('changeme123', 10),
          isActive: isActiveRaw === 'true' || isActiveRaw === '1',
        };
        if (row.phone) data.phone = String(row.phone);
        if (row.mobile) data.mobile = String(row.mobile);
        if (row.residentType) data.residentType = String(row.residentType);
        if (row.dateOfBirth) { const d = parseDateSafe(row.dateOfBirth); if (d) data.dateOfBirth = d; }
        if (row.leaseBeginDate) { const d = parseDateSafe(row.leaseBeginDate); if (d) data.leaseBeginDate = d; }
        if (row.leaseEndDate) { const d = parseDateSafe(row.leaseEndDate); if (d) data.leaseEndDate = d; }
        if (row.note) data.note = String(row.note);
        await this.prisma.user.create({ data: data as any });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }
}
