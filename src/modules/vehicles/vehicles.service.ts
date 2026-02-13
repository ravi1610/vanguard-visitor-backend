import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

const VEHICLE_SORT_FIELDS = ['plateNumber', 'make', 'model', 'createdAt'] as const;

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateVehicleDto) {
    return this.prisma.vehicle.create({
      data: {
        tenantId,
        plateNumber: dto.plateNumber,
        make: dto.make,
        model: dto.model,
        ownerType: dto.ownerType ?? 'other',
        ownerId: dto.ownerId,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto, ownerId?: string) {
    const where: { tenantId: string; ownerId?: string; OR?: object[] } = { tenantId };
    if (ownerId) where.ownerId = ownerId;
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && VEHICLE_SORT_FIELDS.includes(query.sortField as (typeof VEHICLE_SORT_FIELDS)[number]) ? query.sortField : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, tenantId },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async update(tenantId: string, id: string, dto: UpdateVehicleDto) {
    await this.findOne(tenantId, id);
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...(dto.plateNumber != null && { plateNumber: dto.plateNumber }),
        ...(dto.make !== undefined && { make: dto.make }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.ownerType !== undefined && { ownerType: dto.ownerType }),
        ...(dto.ownerId !== undefined && { ownerId: dto.ownerId }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async updatePhoto(tenantId: string, id: string, photoUrl: string) {
    await this.findOne(tenantId, id);
    return this.prisma.vehicle.update({ where: { id }, data: { photoUrl } });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.vehicle.delete({ where: { id } });
  }
}
