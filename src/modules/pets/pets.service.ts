import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

const SORT_FIELDS = ['name', 'species', 'createdAt'] as const;

@Injectable()
export class PetsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreatePetDto) {
    return this.prisma.pet.create({
      data: {
        tenantId,
        userId: dto.userId,
        name: dto.name,
        species: dto.species ?? 'other',
        breed: dto.breed,
        color: dto.color,
        weight: dto.weight,
        registrationNumber: dto.registrationNumber,
        isServiceAnimal: dto.isServiceAnimal ?? false,
        notes: dto.notes,
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
        { breed: { contains: search, mode: 'insensitive' } },
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
      this.prisma.pet.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.pet.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.pet.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('Pet not found');
    return record;
  }

  async update(tenantId: string, id: string, dto: UpdatePetDto) {
    await this.findOne(tenantId, id);
    return this.prisma.pet.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.species !== undefined && { species: dto.species }),
        ...(dto.breed !== undefined && { breed: dto.breed }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
        ...(dto.registrationNumber !== undefined && { registrationNumber: dto.registrationNumber }),
        ...(dto.isServiceAnimal !== undefined && { isServiceAnimal: dto.isServiceAnimal }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.pet.delete({ where: { id } });
  }
}
