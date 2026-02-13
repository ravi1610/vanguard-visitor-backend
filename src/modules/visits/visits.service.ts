import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitStatus } from '@prisma/client';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { CheckInDto } from './dto/checkin.dto';
import { ScheduleVisitDto } from './dto/schedule-visit.dto';
import {
  generateQrToken,
  generateQrDataUrl,
  verifyQrToken,
} from '../../common/utils/qr';

const VISIT_SORT_FIELDS = ['createdAt', 'checkInAt', 'checkOutAt', 'status'] as const;

const VISIT_INCLUDE = {
  visitor: true,
  hostUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}

  async checkIn(tenantId: string, dto: CheckInDto) {
    const [visitor, host] = await Promise.all([
      this.prisma.visitor.findFirst({ where: { id: dto.visitorId, tenantId } }),
      this.prisma.user.findFirst({ where: { id: dto.hostUserId, tenantId } }),
    ]);
    if (!visitor) throw new NotFoundException('Visitor not found');
    if (!host) throw new NotFoundException('Host user not found');

    const now = new Date();
    return this.prisma.visit.create({
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
  }

  async schedule(tenantId: string, dto: ScheduleVisitDto, qrSecret: string) {
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

    // Generate QR code if requested (default true)
    if (dto.generateQr !== false) {
      return this.generateQr(tenantId, visit.id, qrSecret);
    }

    return visit;
  }

  async generateQr(tenantId: string, visitId: string, secret: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, tenantId },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.status !== VisitStatus.scheduled) {
      throw new BadRequestException('QR codes can only be generated for scheduled visits');
    }

    const qrToken = generateQrToken(visitId, secret);
    const qrCode = await generateQrDataUrl(qrToken);

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
    return this.prisma.visit.update({
      where: { id: result.visitId },
      data: { checkInAt: now, status: VisitStatus.checked_in },
      include: VISIT_INCLUDE,
    });
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
    return this.prisma.visit.update({
      where: { id: visitId },
      data: { checkOutAt: now, status: VisitStatus.checked_out },
      include: VISIT_INCLUDE,
    });
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
    return this.prisma.visit.findMany({
      where: { tenantId, status: VisitStatus.checked_in },
      orderBy: { checkInAt: 'desc' },
      include: VISIT_INCLUDE,
    });
  }
}
