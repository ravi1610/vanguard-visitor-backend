import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

const UNIT_SORT_FIELDS = [
  'unitNumber',
  'building',
  'floor',
  'unitType',
  'status',
  'createdAt',
] as const;

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateUnitDto) {
    return this.prisma.unit.create({
      data: {
        tenantId,
        unitNumber: dto.unitNumber,
        building: dto.building,
        floor: dto.floor,
        unitType: dto.unitType,
        status: dto.status ?? 'vacant',
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto, status?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { unitNumber: { contains: search, mode: 'insensitive' } },
        { building: { contains: search, mode: 'insensitive' } },
        { floor: { contains: search, mode: 'insensitive' } },
        { unitType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const sortField =
      query.sortField &&
      UNIT_SORT_FIELDS.includes(
        query.sortField as (typeof UNIT_SORT_FIELDS)[number],
      )
        ? query.sortField
        : 'unitNumber';
    const sortDir = query.sortDir === 'desc' ? 'desc' : 'asc';

    const [rows, total] = await Promise.all([
      this.prisma.unit.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: {
          _count: {
            select: {
              residents: true,
              vehicles: true,
              packages: true,
              maintenance: true,
              violations: true,
            },
          },
          residents: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              residentType: true,
              isActive: true,
            },
            orderBy: { createdAt: 'asc' as const },
          },
          vehicles: {
            select: {
              id: true,
              plateNumber: true,
              make: true,
              model: true,
              color: true,
              year: true,
            },
          },
          packages: {
            select: {
              id: true,
              recipientName: true,
              carrier: true,
              trackingNumber: true,
              status: true,
              size: true,
              receivedAt: true,
            },
            orderBy: { receivedAt: 'desc' as const },
          },
        },
      }),
      this.prisma.unit.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const unit = await this.prisma.unit.findFirst({
      where: { id, tenantId },
      include: {
        residents: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            mobile: true,
            residentType: true,
            isActive: true,
          },
        },
        vehicles: {
          select: {
            id: true,
            plateNumber: true,
            make: true,
            model: true,
            color: true,
            year: true,
            ownerType: true,
          },
        },
        maintenance: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            dueDate: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        violations: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            issuedDate: true,
          },
          orderBy: { issuedDate: 'desc' },
          take: 20,
        },
        packages: {
          select: {
            id: true,
            recipientName: true,
            carrier: true,
            status: true,
            receivedAt: true,
            trackingNumber: true,
          },
          orderBy: { receivedAt: 'desc' },
          take: 20,
        },
        _count: { select: { residents: true, vehicles: true } },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async update(tenantId: string, id: string, dto: UpdateUnitDto) {
    await this.findOne(tenantId, id);
    return this.prisma.unit.update({
      where: { id },
      data: {
        ...(dto.unitNumber != null && { unitNumber: dto.unitNumber }),
        ...(dto.building !== undefined && { building: dto.building }),
        ...(dto.floor !== undefined && { floor: dto.floor }),
        ...(dto.unitType !== undefined && { unitType: dto.unitType }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.unit.delete({ where: { id } });
  }
}
