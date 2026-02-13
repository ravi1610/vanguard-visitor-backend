import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

const CALENDAR_SORT_FIELDS = ['title', 'startAt', 'endAt', 'type'] as const;

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateCalendarEventDto) {
    return this.prisma.calendarEvent.create({
      data: {
        tenantId,
        title: dto.title,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        type: dto.type,
        location: dto.location,
        description: dto.description,
      },
    });
  }

  async findAll(tenantId: string, query: PagedQueryDto, from?: string, to?: string) {
    const where: { tenantId: string; startAt?: object; OR?: object[] } = { tenantId };
    if (from || to) {
      where.startAt = {};
      if (from) (where.startAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.startAt as Record<string, unknown>).lte = new Date(to);
    }
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && CALENDAR_SORT_FIELDS.includes(query.sortField as (typeof CALENDAR_SORT_FIELDS)[number]) ? query.sortField : 'startAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';
    const [rows, total] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
      }),
      this.prisma.calendarEvent.count({ where }),
    ]);
    return { rows, total };
  }

  async findOne(tenantId: string, id: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id, tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async update(tenantId: string, id: string, dto: UpdateCalendarEventDto) {
    await this.findOne(tenantId, id);
    return this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.title != null && { title: dto.title }),
        ...(dto.startAt != null && { startAt: new Date(dto.startAt) }),
        ...(dto.endAt != null && { endAt: new Date(dto.endAt) }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.calendarEvent.delete({ where: { id } });
  }
}
