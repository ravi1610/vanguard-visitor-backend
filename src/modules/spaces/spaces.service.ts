import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { CreateSpaceAssignmentDto } from './dto/create-space-assignment.dto';
import { UpdateSpaceAssignmentDto } from './dto/update-space-assignment.dto';

const ASSIGNMENT_SORT_FIELDS = ['fromDate', 'toDate', 'assigneeType'] as const;

@Injectable()
export class SpacesService {
  constructor(private prisma: PrismaService) {}

  async createSpace(tenantId: string, dto: CreateSpaceDto) {
    return this.prisma.space.create({
      data: {
        tenantId,
        name: dto.name,
        type: dto.type ?? 'parking',
      },
    });
  }

  async findAllSpaces(tenantId: string, query?: PagedQueryDto) {
    if (!query?.page && !query?.pageSize) {
      return this.prisma.space.findMany({
        where: { tenantId },
        include: { assignments: true },
        orderBy: [{ name: 'asc' }],
      });
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = (query.sortField === 'name' || query.sortField === 'type') ? query.sortField : 'name';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const where: { tenantId: string; OR?: object[] } = { tenantId };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { type: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.space.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: { _count: { select: { assignments: true } } },
      }),
      this.prisma.space.count({ where }),
    ]);
    return { rows, total };
  }

  async findOneSpace(tenantId: string, id: string) {
    const space = await this.prisma.space.findFirst({
      where: { id, tenantId },
      include: { assignments: true },
    });
    if (!space) throw new NotFoundException('Space not found');
    return space;
  }

  async updateSpace(tenantId: string, id: string, dto: UpdateSpaceDto) {
    await this.findOneSpace(tenantId, id);
    return this.prisma.space.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
      },
    });
  }

  async removeSpace(tenantId: string, id: string) {
    await this.findOneSpace(tenantId, id);
    return this.prisma.space.delete({ where: { id } });
  }

  async createAssignment(tenantId: string, dto: CreateSpaceAssignmentDto) {
    const space = await this.prisma.space.findFirst({
      where: { id: dto.spaceId, tenantId },
    });
    if (!space) throw new NotFoundException('Space not found');
    return this.prisma.spaceAssignment.create({
      data: {
        tenantId,
        spaceId: dto.spaceId,
        assigneeType: dto.assigneeType,
        assigneeId: dto.assigneeId,
        fromDate: new Date(dto.fromDate),
        toDate: new Date(dto.toDate),
      },
    });
  }

  async findAllAssignments(tenantId: string, query: PagedQueryDto, spaceId?: string, assigneeId?: string) {
    const where: { tenantId: string; spaceId?: string; assigneeId?: string } = { tenantId };
    if (spaceId) where.spaceId = spaceId;
    if (assigneeId) where.assigneeId = assigneeId;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && ASSIGNMENT_SORT_FIELDS.includes(query.sortField as (typeof ASSIGNMENT_SORT_FIELDS)[number]) ? query.sortField : 'fromDate';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.spaceAssignment.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: { space: true },
      }),
      this.prisma.spaceAssignment.count({ where }),
    ]);
    return { rows, total };
  }

  async findOneAssignment(tenantId: string, id: string) {
    const a = await this.prisma.spaceAssignment.findFirst({
      where: { id, tenantId },
      include: { space: true },
    });
    if (!a) throw new NotFoundException('Assignment not found');
    return a;
  }

  async updateAssignment(
    tenantId: string,
    id: string,
    dto: UpdateSpaceAssignmentDto,
  ) {
    await this.findOneAssignment(tenantId, id);
    return this.prisma.spaceAssignment.update({
      where: { id },
      data: {
        ...(dto.spaceId != null && { spaceId: dto.spaceId }),
        ...(dto.assigneeType != null && { assigneeType: dto.assigneeType }),
        ...(dto.assigneeId != null && { assigneeId: dto.assigneeId }),
        ...(dto.fromDate != null && { fromDate: new Date(dto.fromDate) }),
        ...(dto.toDate != null && { toDate: new Date(dto.toDate) }),
      },
    });
  }

  async removeAssignment(tenantId: string, id: string) {
    await this.findOneAssignment(tenantId, id);
    return this.prisma.spaceAssignment.delete({ where: { id } });
  }
}
