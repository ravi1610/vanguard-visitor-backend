import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

const PACKAGE_SORT_FIELDS = [
  'trackingNumber',
  'recipientName',
  'status',
  'carrier',
  'receivedAt',
  'createdAt',
] as const;

const PACKAGE_INCLUDE = {
  recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
  receivedBy: { select: { id: true, firstName: true, lastName: true } },
  pickedUpBy: { select: { id: true, firstName: true, lastName: true } },
  unit: { select: { id: true, unitNumber: true, building: true } },
};

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreatePackageDto) {
    return this.prisma.package.create({
      data: {
        tenantId,
        trackingNumber: dto.trackingNumber,
        carrier: dto.carrier,
        size: dto.size,
        recipientId: dto.recipientId,
        recipientName: dto.recipientName,
        unitId: dto.unitId,
        description: dto.description,
        storageLocation: dto.storageLocation,
        isPerishable: dto.isPerishable ?? false,
        notes: dto.notes,
      },
      include: PACKAGE_INCLUDE,
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto, status?: string) {
    const where: { tenantId: string; status?: any; OR?: object[] } = { tenantId };

    if (status) where.status = status;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { recipientName: { contains: search, mode: 'insensitive' } },
        { carrier: { contains: search, mode: 'insensitive' } },
        { unit: { unitNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField =
      query.sortField &&
      PACKAGE_SORT_FIELDS.includes(query.sortField as (typeof PACKAGE_SORT_FIELDS)[number])
        ? query.sortField
        : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.package.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: PACKAGE_INCLUDE,
      }),
      this.prisma.package.count({ where }),
    ]);

    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const pkg = await this.prisma.package.findFirst({
      where: { id, tenantId },
      include: PACKAGE_INCLUDE,
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async update(tenantId: string, id: string, dto: UpdatePackageDto) {
    await this.findOne(tenantId, id);
    return this.prisma.package.update({
      where: { id },
      data: {
        ...(dto.trackingNumber !== undefined && { trackingNumber: dto.trackingNumber }),
        ...(dto.carrier !== undefined && { carrier: dto.carrier }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.size !== undefined && { size: dto.size }),
        ...(dto.recipientId !== undefined && { recipientId: dto.recipientId }),
        ...(dto.recipientName !== undefined && { recipientName: dto.recipientName }),
        ...(dto.unitId !== undefined && { unitId: dto.unitId || null }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.storageLocation !== undefined && { storageLocation: dto.storageLocation }),
        ...(dto.isPerishable !== undefined && { isPerishable: dto.isPerishable }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: PACKAGE_INCLUDE,
    });
  }

  async pickup(tenantId: string, id: string, pickedUpById: string) {
    await this.findOne(tenantId, id);
    return this.prisma.package.update({
      where: { id },
      data: {
        status: 'picked_up',
        pickedUpAt: new Date(),
        pickedUpById,
      },
      include: PACKAGE_INCLUDE,
    });
  }

  async updatePhoto(tenantId: string, id: string, photoUrl: string) {
    await this.findOne(tenantId, id);
    return this.prisma.package.update({
      where: { id },
      data: { photoUrl },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.package.delete({ where: { id } });
  }
}
