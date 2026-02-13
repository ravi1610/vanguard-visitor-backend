import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';

const SORT_FIELDS = ['name', 'relationship', 'createdAt'] as const;

@Injectable()
export class EmergencyContactsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateEmergencyContactDto) {
    return this.prisma.emergencyContact.create({
      data: {
        tenantId,
        userId: dto.userId,
        name: dto.name,
        relationship: dto.relationship ?? 'other',
        phone: dto.phone,
        email: dto.email,
        isPrimary: dto.isPrimary ?? false,
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto, userId?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (userId) where.userId = userId;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField =
      query.sortField &&
      SORT_FIELDS.includes(query.sortField as (typeof SORT_FIELDS)[number])
        ? query.sortField
        : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.emergencyContact.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.emergencyContact.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.emergencyContact.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Emergency contact not found');
    return record;
  }

  async update(tenantId: string, id: string, dto: UpdateEmergencyContactDto) {
    await this.findOne(tenantId, id);
    return this.prisma.emergencyContact.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.relationship !== undefined && { relationship: dto.relationship }),
        ...(dto.phone != null && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.isPrimary !== undefined && { isPrimary: dto.isPrimary }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.emergencyContact.delete({ where: { id } });
  }
}
