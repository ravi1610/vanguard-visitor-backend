import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateSafe } from '../../common/utils/parse-date';
import { applyFilters } from '../../common/utils/filter-utils';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';

export const CALENDAR_FIELD_MAPPING: FieldMapping[] = [
  { field: 'title', header: 'Title', required: true },
  { field: 'startAt', header: 'Start Date', required: true },
  { field: 'endAt', header: 'End Date' },
  { field: 'type', header: 'Type' },
  { field: 'location', header: 'Location' },
  { field: 'description', header: 'Description' },
];

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
        notifyVia: dto.notifyVia ?? [],
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
    applyFilters(where, query.filters);
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
        ...(dto.notifyVia !== undefined && { notifyVia: dto.notifyVia }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.calendarEvent.delete({ where: { id } });
  }

  async exportAll(tenantId: string, selectedIds?: string[]) {
    const where: any = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    return this.prisma.calendarEvent.findMany({ where, orderBy: { startAt: 'desc' } });
  }

  async bulkImport(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const missing: string[] = [];
        if (!row.title || !String(row.title).trim()) missing.push('Title');
        const startAt = parseDateSafe(row.startAt);
        if (!startAt) missing.push('Start Date');
        if (missing.length) { result.errors.push({ row: i + 2, message: `Missing required: ${missing.join(', ')}` }); continue; }
        const data: Record<string, unknown> = { tenantId, title: String(row.title ?? ''), startAt };
        if (row.endAt) { const d = parseDateSafe(row.endAt); if (d) data.endAt = d; }
        if (row.type) data.type = String(row.type);
        if (row.location) data.location = String(row.location);
        if (row.description) data.description = String(row.description);
        await this.prisma.calendarEvent.create({ data: data as any });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }
}
