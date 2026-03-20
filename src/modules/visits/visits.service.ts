import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitStatus } from '@prisma/client';
import { applyFilters, equals } from '../../common/utils/filter-utils';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CheckInDto } from './dto/checkin.dto';
import { ScheduleVisitDto } from './dto/schedule-visit.dto';
import {
  generateQrToken,
  generateQrDataUrl,
  verifyQrToken,
} from '../../common/utils/qr';
import { NotificationsService } from '../notifications/notifications.service';
import type { FieldMapping, ImportResult } from '../../common/import-export/import-export.service';

export const VISIT_FIELD_MAPPING: FieldMapping[] = [
  { field: 'visitorFirstName', header: 'Visitor First Name' },
  { field: 'visitorLastName', header: 'Visitor Last Name' },
  { field: 'visitorEmail', header: 'Visitor Email' },
  { field: 'hostEmail', header: 'Host Email' },
  { field: 'purpose', header: 'Purpose' },
  { field: 'status', header: 'Status' },
  { field: 'scheduledStart', header: 'Scheduled Start' },
  { field: 'checkInAt', header: 'Check In' },
  { field: 'checkOutAt', header: 'Check Out' },
];

const ACTIVE_VISITS_TTL = 30_000; // 30 seconds

const VISIT_SORT_FIELDS = ['createdAt', 'checkInAt', 'checkOutAt', 'status'] as const;

const VISIT_INCLUDE = {
  visitor: true,
  hostUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

@Injectable()
export class VisitsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    private notifications: NotificationsService,
  ) {}

  async checkIn(tenantId: string, dto: CheckInDto) {
    const [visitor, host] = await Promise.all([
      this.prisma.visitor.findFirst({ where: { id: dto.visitorId, tenantId } }),
      this.prisma.user.findFirst({ where: { id: dto.hostUserId, tenantId } }),
    ]);
    if (!visitor) throw new NotFoundException('Visitor not found');
    if (!host) throw new NotFoundException('Host user not found');

    const now = new Date();
    const visit = await this.prisma.visit.create({
      data: {
        tenantId,
        visitorId: dto.visitorId,
        hostUserId: dto.hostUserId,
        purpose: dto.purpose,
        location: dto.location,
        checkInAt: now,
        status: VisitStatus.checked_in,
      },
      include: VISIT_INCLUDE,
    });

    // Invalidate active visits cache on check-in
    await this.cache.del(`visits:active:${tenantId}`);

    this.notifications.notify({
      tenantId,
      eventType: 'visit.checkin',
      recipientUserId: dto.hostUserId,
      data: {
        visitorName: `${visit.visitor.firstName} ${visit.visitor.lastName}`,
        location: dto.location || 'the front desk',
      },
    }).catch(() => {});

    return visit;
  }

  async schedule(tenantId: string, dto: ScheduleVisitDto, qrSecret: string, appUrl: string) {
    const [visitor, host] = await Promise.all([
      this.prisma.visitor.findFirst({ where: { id: dto.visitorId, tenantId } }),
      this.prisma.user.findFirst({ where: { id: dto.hostUserId, tenantId } }),
    ]);
    if (!visitor) throw new NotFoundException('Visitor not found');
    if (!host) throw new NotFoundException('Host user not found');

    const visit = await this.prisma.visit.create({
      data: {
        tenantId,
        visitorId: dto.visitorId,
        hostUserId: dto.hostUserId,
        purpose: dto.purpose,
        location: dto.location,
        scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : undefined,
        status: VisitStatus.scheduled,
      },
      include: VISIT_INCLUDE,
    });

    this.notifications.notify({
      tenantId,
      eventType: 'visit.scheduled',
      recipientUserId: dto.hostUserId,
      data: {
        visitorName: `${visit.visitor.firstName} ${visit.visitor.lastName}`,
        date: dto.scheduledStart || 'TBD',
      },
    }).catch(() => {});

    // Generate QR code if requested (default true)
    if (dto.generateQr !== false) {
      return this.generateQr(tenantId, visit.id, qrSecret, appUrl);
    }

    return visit;
  }

  async generateQr(tenantId: string, visitId: string, secret: string, appUrl: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, tenantId },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.status !== VisitStatus.scheduled) {
      throw new BadRequestException('QR codes can only be generated for scheduled visits');
    }

    const qrToken = generateQrToken(visitId, secret);
    // Encode a full URL so iPhone/Android cameras auto-open browser on scan
    const qrUrl = `${appUrl}/scan/${qrToken}`;
    const qrCode = await generateQrDataUrl(qrUrl);

    return this.prisma.visit.update({
      where: { id: visitId },
      data: { qrToken, qrCode },
      include: VISIT_INCLUDE,
    });
  }

  async scanQr(tenantId: string, token: string, secret: string) {
    const result = verifyQrToken(token, secret);
    if (!result.valid || !result.visitId) {
      throw new BadRequestException('Invalid QR code');
    }

    const visit = await this.prisma.visit.findFirst({
      where: { id: result.visitId, tenantId },
      include: VISIT_INCLUDE,
    });
    if (!visit) throw new NotFoundException('Visit not found');

    if (visit.status === VisitStatus.checked_in) {
      throw new BadRequestException('Visitor is already checked in');
    }
    if (visit.status === VisitStatus.checked_out) {
      throw new BadRequestException('Visit has already been completed');
    }
    if (visit.status !== VisitStatus.scheduled) {
      throw new BadRequestException('Visit is not in a schedulable state');
    }

    const now = new Date();
    const updated = await this.prisma.visit.update({
      where: { id: result.visitId },
      data: { checkInAt: now, status: VisitStatus.checked_in },
      include: VISIT_INCLUDE,
    });

    // Invalidate active visits cache on QR check-in
    await this.cache.del(`visits:active:${tenantId}`);

    this.notifications.notify({
      tenantId,
      eventType: 'visit.checkin',
      recipientUserId: updated.hostUser.id,
      data: {
        visitorName: `${updated.visitor.firstName} ${updated.visitor.lastName}`,
        location: updated.location || 'the front desk',
      },
    }).catch(() => {});

    return updated;
  }

  async checkout(tenantId: string, visitId: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, tenantId },
      include: { visitor: true },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.status === VisitStatus.checked_out) {
      throw new BadRequestException('Visit already checked out');
    }

    const now = new Date();
    const updated = await this.prisma.visit.update({
      where: { id: visitId },
      data: { checkOutAt: now, status: VisitStatus.checked_out },
      include: VISIT_INCLUDE,
    });

    // Invalidate active visits cache on check-out
    await this.cache.del(`visits:active:${tenantId}`);
    return updated;
  }

  async findAll(
    tenantId: string,
    query: PagedQueryDto,
    options?: { from?: Date; to?: Date; status?: VisitStatus; hostUserId?: string },
  ) {
    const where: {
      tenantId: string;
      createdAt?: object;
      status?: VisitStatus;
      hostUserId?: string;
    } = {
      tenantId,
    };
    if (options?.from || options?.to) {
      where.createdAt = {};
      if (options.from)
        (where.createdAt as Record<string, unknown>).gte = options.from;
      if (options.to)
        (where.createdAt as Record<string, unknown>).lte = options.to;
    }
    if (options?.status) where.status = options.status;
    if (options?.hostUserId) where.hostUserId = options.hostUserId;
    applyFilters(where, query.filters, { status: equals('status') });

    const search = query.search?.trim();
    if (search) {
      (where as any).OR = [
        { visitor: { firstName: { contains: search, mode: 'insensitive' } } },
        { visitor: { lastName: { contains: search, mode: 'insensitive' } } },
        { purpose: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField && VISIT_SORT_FIELDS.includes(query.sortField as (typeof VISIT_SORT_FIELDS)[number]) ? query.sortField : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: VISIT_INCLUDE,
      }),
      this.prisma.visit.count({ where }),
    ]);
    return { rows, total };
  }

  async findActive(tenantId: string) {
    const cacheKey = `visits:active:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const visits = await this.prisma.visit.findMany({
      where: { tenantId, status: VisitStatus.checked_in },
      orderBy: { checkInAt: 'desc' },
      include: VISIT_INCLUDE,
    });

    await this.cache.set(cacheKey, visits, ACTIVE_VISITS_TTL);
    return visits;
  }

  /**
   * Public QR scan — no auth required. Token is HMAC-signed so it can't be forged.
   * Returns limited data (visitor name + check-in time only).
   */
  async publicScanQr(token: string, secret: string) {
    const result = verifyQrToken(token, secret);
    if (!result.valid || !result.visitId) {
      throw new BadRequestException('Invalid QR code');
    }

    const visit = await this.prisma.visit.findUnique({
      where: { id: result.visitId },
      include: {
        visitor: { select: { firstName: true, lastName: true, company: true } },
        hostUser: { select: { id: true } },
      },
    });
    if (!visit) throw new NotFoundException('Visit not found');

    if (visit.status === VisitStatus.checked_in) {
      throw new BadRequestException('Visitor is already checked in');
    }
    if (visit.status === VisitStatus.checked_out) {
      throw new BadRequestException('Visit has already been completed');
    }
    if (visit.status !== VisitStatus.scheduled) {
      throw new BadRequestException('Visit is not in a valid state for check-in');
    }

    const now = new Date();
    await this.prisma.visit.update({
      where: { id: result.visitId },
      data: { checkInAt: now, status: VisitStatus.checked_in },
    });

    // Invalidate active visits cache
    await this.cache.del(`visits:active:${visit.tenantId}`);

    if (visit.hostUser) {
      this.notifications.notify({
        tenantId: visit.tenantId,
        eventType: 'visit.checkin',
        recipientUserId: visit.hostUser.id,
        data: {
          visitorName: `${visit.visitor.firstName} ${visit.visitor.lastName}`,
          location: visit.purpose || 'the front desk',
        },
      }).catch(() => {});
    }

    // Return limited public-safe data
    return {
      success: true,
      visitorName: `${visit.visitor.firstName} ${visit.visitor.lastName}`,
      company: visit.visitor.company,
      purpose: visit.purpose,
      checkInAt: now.toISOString(),
    };
  }

  async exportAll(tenantId: string, selectedIds?: string[], status?: string) {
    const where: any = { tenantId };
    if (selectedIds?.length) where.id = { in: selectedIds };
    if (status) where.status = status;
    const visits = await this.prisma.visit.findMany({
      where,
      include: { visitor: true, hostUser: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return visits.map((v) => ({
      ...v,
      visitorFirstName: v.visitor?.firstName ?? '',
      visitorLastName: v.visitor?.lastName ?? '',
      visitorEmail: v.visitor?.email ?? '',
      hostEmail: (v as any).hostUser?.email ?? '',
    }));
  }

  async bulkImport(tenantId: string, rows: Record<string, unknown>[]): Promise<ImportResult> {
    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const firstName = String(row.visitorFirstName ?? '').trim();
        const lastName = String(row.visitorLastName ?? '').trim();
        if (!firstName) { result.errors.push({ row: i + 2, message: 'Missing required: Visitor First Name' }); continue; }

        const email = String(row.visitorEmail ?? '').trim() || undefined;
        // Find or create visitor
        let visitor = email
          ? await this.prisma.visitor.findFirst({ where: { tenantId, email } })
          : await this.prisma.visitor.findFirst({ where: { tenantId, firstName, lastName } });
        if (!visitor) {
          visitor = await this.prisma.visitor.create({ data: { tenantId, firstName, lastName, email } });
        }

        // Resolve host user
        const hostEmail = String(row.hostEmail ?? '').trim();
        let hostUserId: string | undefined;
        if (hostEmail) {
          const host = await this.prisma.user.findFirst({ where: { tenantId, email: hostEmail } });
          if (host) hostUserId = host.id;
        }
        if (!hostUserId) {
          // Default to first active admin/manager in tenant
          const fallback = await this.prisma.user.findFirst({ where: { tenantId, isActive: true }, orderBy: { createdAt: 'asc' } });
          if (!fallback) { result.errors.push({ row: i + 2, message: 'No host user found in tenant' }); continue; }
          hostUserId = fallback.id;
        }

        await this.prisma.visit.create({
          data: {
            tenantId,
            visitorId: visitor.id,
            hostUserId,
            purpose: row.purpose ? String(row.purpose) : undefined,
            status: 'scheduled',
            scheduledStart: row.scheduledStart ? new Date(String(row.scheduledStart)) : undefined,
          },
        });
        result.created++;
      } catch (e) { result.errors.push({ row: i + 2, message: e instanceof Error ? e.message : 'Unknown error' }); }
    }
    return result;
  }
}
