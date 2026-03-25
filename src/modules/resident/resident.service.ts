import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, VehicleOwnerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { applyFilters, equals } from '../../common/utils/filter-utils';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { ResidentScheduleVisitDto, SendVia } from './dto/schedule-visit.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ResidentCreateMaintenanceDto } from './dto/resident-create-maintenance.dto';
import { generateQrToken, generateQrDataUrl } from '../../common/utils/qr';
import { SmsService } from '../sms/sms.service';
import { EmailService } from '../email/email.service';

const VISIT_INCLUDE = {
  visitor: true,
  hostUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

const PACKAGE_INCLUDE = {
  recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
  receivedBy: { select: { id: true, firstName: true, lastName: true } },
  pickedUpBy: { select: { id: true, firstName: true, lastName: true } },
  unit: { select: { id: true, unitNumber: true, building: true } },
} as const;

const MAINTENANCE_INCLUDE = {
  assignedTo: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  unit: { select: { id: true, unitNumber: true, building: true } },
} as const;

@Injectable()
export class ResidentService {
  private readonly logger = new Logger(ResidentService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private sms: SmsService,
    private email: EmailService,
  ) {}

  // ── Profile ──────────────────────────────────────────────

  async getProfile(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        mobile: true,
        photoUrl: true,
        residentType: true,
        isHandicapped: true,
        isBoardMember: true,
        movingDate: true,
        dateOfBirth: true,
        leaseBeginDate: true,
        leaseEndDate: true,
        workInfo: true,
        otherContactInfo: true,
        note: true,
        unit: { select: { id: true, unitNumber: true, building: true } },
        emergencyContacts: true,
        pets: true,
        violations: { select: { id: true, title: true, status: true, createdAt: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(tenantId: string, userId: string, dto: UpdateProfileDto) {
    await this.prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: {
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.mobile !== undefined && { mobile: dto.mobile }),
      },
    });
    return this.getProfile(tenantId, userId);
  }

  // ── Visitors ─────────────────────────────────────────────

  async getVisitors(
    tenantId: string,
    userId: string,
    query: PagedQueryDto,
    status?: string,
  ) {
    const where: any = { tenantId, hostUserId: userId };
    if (status) where.status = status;
    applyFilters(where, query.filters, { status: equals('status') });

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { visitor: { firstName: { contains: search, mode: 'insensitive' } } },
        { visitor: { lastName: { contains: search, mode: 'insensitive' } } },
        { purpose: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortField = query.sortField || 'createdAt';
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

  async getVisitorDetail(tenantId: string, userId: string, visitId: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, tenantId, hostUserId: userId },
      include: VISIT_INCLUDE,
    });
    if (!visit) throw new NotFoundException('Visit not found');
    return visit;
  }

  async scheduleVisit(tenantId: string, userId: string, dto: ResidentScheduleVisitDto) {
    // Parse visitor name (split into first/last)
    const nameParts = dto.visitorName.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Find or create visitor
    let visitor = await this.prisma.visitor.findFirst({
      where: {
        tenantId,
        firstName: { equals: firstName, mode: 'insensitive' },
        lastName: { equals: lastName, mode: 'insensitive' },
      },
    });

    if (!visitor) {
      visitor = await this.prisma.visitor.create({
        data: {
          tenantId,
          firstName,
          lastName,
          email: dto.email,
          phone: dto.phone,
        },
      });
    }

    // Get host user info
    const host = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    // Get tenant info for property name
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    // Create the visit
    const visit = await this.prisma.visit.create({
      data: {
        tenantId,
        visitorId: visitor.id,
        hostUserId: userId,
        purpose: dto.purpose,
        scheduledStart: new Date(dto.arrivalDate),
        scheduledEnd: dto.arrivalEndDate ? new Date(dto.arrivalEndDate) : undefined,
        status: 'scheduled',
      },
      include: VISIT_INCLUDE,
    });

    // Generate QR code
    const qrSecret = this.config.get<string>('QR_SECRET') || 'vanguard-dev-qr-secret';
    const appUrl = this.config.get<string>('app.url') || 'http://localhost:5173';
    const qrToken = generateQrToken(visit.id, qrSecret);
    const qrDataUrl = await generateQrDataUrl(qrToken);
    const scanLink = `${appUrl}/scan/${qrToken}`;

    // Save QR to visit
    await this.prisma.visit.update({
      where: { id: visit.id },
      data: { qrToken, qrCode: qrDataUrl },
    });

    const hostName = `${host?.firstName || ''} ${host?.lastName || ''}`.trim();
    const propertyName = tenant?.name || 'the property';
    const dateFormatted = new Date(dto.arrivalDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    // Send invitations
    const sendSms = dto.sendVia === SendVia.sms || dto.sendVia === SendVia.both;
    const sendEmail = dto.sendVia === SendVia.email || dto.sendVia === SendVia.both;

    if (sendSms && dto.phone) {
      const smsBody = `Hi ${firstName}, you've been invited to visit ${propertyName} on ${dateFormatted}. Check in here: ${scanLink}`;
      this.sms.send(dto.phone, smsBody).catch((err) => {
        this.logger.error(`Failed to send visit SMS: ${err.message}`);
      });
    }

    if (sendEmail && dto.email) {
      this.email
        .sendVisitorInvite({
          to: dto.email,
          visitorName: `${firstName} ${lastName}`.trim(),
          hostName,
          propertyName,
          date: dateFormatted,
          qrDataUrl,
          scanLink,
        })
        .catch((err) => {
          this.logger.error(`Failed to send visit email: ${err.message}`);
        });
    }

    return { ...visit, qrToken, qrCode: qrDataUrl, scanLink };
  }

  async cancelVisit(tenantId: string, userId: string, visitId: string) {
    const visit = await this.prisma.visit.findFirst({
      where: { id: visitId, tenantId, hostUserId: userId, status: 'scheduled' },
    });
    if (!visit) throw new NotFoundException('Scheduled visit not found');

    return this.prisma.visit.update({
      where: { id: visitId },
      data: { status: 'no_show' },
      include: VISIT_INCLUDE,
    });
  }

  // ── Packages ─────────────────────────────────────────────

  async getPackages(tenantId: string, userId: string, query: PagedQueryDto, status?: string) {
    const where: any = { tenantId, recipientId: userId };
    if (status) where.status = status;
    applyFilters(where, query.filters, { status: equals('status') });

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { carrier: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.package.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: sortDir },
        include: PACKAGE_INCLUDE,
      }),
      this.prisma.package.count({ where }),
    ]);

    return { rows, total };
  }

  async getPackageDetail(tenantId: string, userId: string, packageId: string) {
    const pkg = await this.prisma.package.findFirst({
      where: { id: packageId, tenantId, recipientId: userId },
      include: PACKAGE_INCLUDE,
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  // ── Maintenance ──────────────────────────────────────────

  async getMaintenanceRequests(
    tenantId: string,
    userId: string,
    query: PagedQueryDto,
    status?: string,
  ) {
    const where: any = { tenantId, assignedToUserId: userId };
    if (status) where.status = status;
    applyFilters(where, query.filters, { status: equals('status') });

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.maintenance.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: sortDir },
        include: MAINTENANCE_INCLUDE,
      }),
      this.prisma.maintenance.count({ where }),
    ]);

    return { rows, total };
  }

  async createMaintenanceRequest(
    tenantId: string,
    userId: string,
    dto: ResidentCreateMaintenanceDto,
  ) {
    // Get user's unit
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { unitId: true },
    });

    return this.prisma.maintenance.create({
      data: {
        tenantId,
        title: dto.title,
        description: dto.description,
        status: 'open',
        assignedToUserId: userId,
        unitId: user?.unitId || undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: MAINTENANCE_INCLUDE,
    });
  }

  async getMaintenanceDetail(tenantId: string, userId: string, id: string) {
    const m = await this.prisma.maintenance.findFirst({
      where: { id, tenantId, assignedToUserId: userId },
      include: MAINTENANCE_INCLUDE,
    });
    if (!m) throw new NotFoundException('Maintenance request not found');
    return m;
  }

  // ── Documents ────────────────────────────────────────────

  /** Documents uploaded by this resident (personal "My documents"). */
  async getDocuments(tenantId: string, userId: string, query: PagedQueryDto) {
    const where: Prisma.DocumentWhereInput = { tenantId, uploadedByUserId: userId };
    applyFilters(where as any, query.filters);

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: sortDir },
        include: {
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { rows, total };
  }

  async getDocumentDetail(tenantId: string, userId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId, uploadedByUserId: userId },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  /** Tenant-wide documents (global documents visible to all residents). */
  async getGlobalDocuments(tenantId: string, query: PagedQueryDto) {
    const where: Prisma.DocumentWhereInput = { tenantId, uploadedByUserId: null };
    applyFilters(where as any, query.filters);

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { documentType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: sortDir },
        include: {
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { rows, total };
  }

  async getGlobalDocumentDetail(tenantId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, tenantId, uploadedByUserId: null },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  // ── Compliance ───────────────────────────────────────────

  async getCompliance(tenantId: string, query: PagedQueryDto, status?: string) {
    const where: any = { tenantId };
    if (status) where.status = status;
    applyFilters(where, query.filters, { status: equals('status') });

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.complianceItem.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: sortDir },
      }),
      this.prisma.complianceItem.count({ where }),
    ]);

    return { rows, total };
  }

  async getComplianceDetail(tenantId: string, id: string) {
    const item = await this.prisma.complianceItem.findFirst({
      where: { id, tenantId },
    });
    if (!item) throw new NotFoundException('Compliance item not found');
    return item;
  }

  // ── Vehicles (resident-owned or unit-registered) ─────────

  async getVehicles(tenantId: string, userId: string, query: PagedQueryDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { unitId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const unitId = user.unitId;
    const ownershipOr: Prisma.VehicleWhereInput[] = [
      { ownerType: VehicleOwnerType.resident, ownerId: userId },
    ];
    if (unitId) ownershipOr.push({ unitId });

    const andParts: Prisma.VehicleWhereInput[] = [{ OR: ownershipOr }];

    const search = query.search?.trim();
    if (search) {
      andParts.push({
        OR: [
          { plateNumber: { contains: search, mode: 'insensitive' } },
          { make: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    const where: Prisma.VehicleWhereInput = {
      tenantId,
      AND: andParts,
    };

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [rows, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: sortDir },
        include: {
          unit: { select: { id: true, unitNumber: true, building: true } },
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return { rows, total };
  }

  async getVehicleDetail(tenantId: string, userId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { unitId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const unitId = user.unitId;
    const ownershipOr: Prisma.VehicleWhereInput[] = [
      { ownerType: VehicleOwnerType.resident, ownerId: userId },
    ];
    if (unitId) ownershipOr.push({ unitId });

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id,
        tenantId,
        OR: ownershipOr,
      },
      include: {
        unit: { select: { id: true, unitNumber: true, building: true } },
      },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  // ── Calendar (tenant events, read-only) ───────────────────

  private static readonly CALENDAR_SORT_FIELDS = ['title', 'startAt', 'endAt', 'type'] as const;

  async getCalendarEvents(tenantId: string, query: PagedQueryDto, from?: string, to?: string) {
    const where: Prisma.CalendarEventWhereInput = { tenantId };
    if (from || to) {
      where.startAt = {};
      if (from) (where.startAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.startAt as Record<string, unknown>).lte = new Date(to);
    }
    applyFilters(where as any, query.filters);
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
    const sortField =
      query.sortField &&
      ResidentService.CALENDAR_SORT_FIELDS.includes(
        query.sortField as (typeof ResidentService.CALENDAR_SORT_FIELDS)[number],
      )
        ? query.sortField
        : 'startAt';
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

  async getCalendarEventDetail(tenantId: string, id: string) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id, tenantId },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  // ── Dashboard ────────────────────────────────────────────

  async getDashboard(tenantId: string, userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [user, visitorsToday, pendingPackages, activeMaintenanceTickets] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true },
      }),
      this.prisma.visit.count({
        where: {
          tenantId,
          hostUserId: userId,
          status: { in: ['scheduled', 'checked_in'] },
          OR: [
            { scheduledStart: { gte: today, lt: tomorrow } },
            { checkInAt: { gte: today, lt: tomorrow } },
          ],
        },
      }),
      this.prisma.package.count({
        where: {
          tenantId,
          recipientId: userId,
          status: 'received',
        },
      }),
      this.prisma.maintenance.count({
        where: {
          tenantId,
          assignedToUserId: userId,
          status: { in: ['open', 'in_progress'] },
        },
      }),
    ]);

    return {
      userName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      visitorsToday,
      pendingPackages,
      activeMaintenanceTickets,
    };
  }
}
