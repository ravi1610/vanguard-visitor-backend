import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

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
        ...(dto.unit != null && { unit: dto.unit }),
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

  async findAll(tenantId: string, roleKey: string | undefined, query: PagedQueryDto, isActive?: boolean, isBoardMember?: boolean) {
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
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { unit: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const sortField = query.sortField && ['firstName', 'lastName', 'email', 'residentType', 'createdAt', 'unit', 'leaseBeginDate', 'leaseEndDate'].includes(query.sortField)
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
          unit: true,
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
    if (dto.unit !== undefined) data.unit = dto.unit || null;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.mobile !== undefined) data.mobile = dto.mobile || null;
    if (dto.dateOfBirth !== undefined) data.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
    if (dto.leaseBeginDate !== undefined) data.leaseBeginDate = dto.leaseBeginDate ? new Date(dto.leaseBeginDate) : null;
    if (dto.leaseEndDate !== undefined) data.leaseEndDate = dto.leaseEndDate ? new Date(dto.leaseEndDate) : null;

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
}
