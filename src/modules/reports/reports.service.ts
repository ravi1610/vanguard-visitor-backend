import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  private static readonly DASHBOARD_TTL = 60_000; // 60 seconds

  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  // ── Dashboard Stats (existing, unchanged) ────────────────────────

  async getDashboardStats(tenantId: string) {
    const cacheKey = `dashboard:${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    type Row = Record<string, bigint>;
    const tid = tenantId;

    const [totals, filtered, units] = await Promise.all([
      this.prisma.$queryRaw<Row[]>(Prisma.sql`
        SELECT
          (SELECT COUNT(*) FROM visitors   WHERE tenant_id = ${tid}) AS total_visitors,
          (SELECT COUNT(*) FROM visits     WHERE tenant_id = ${tid}) AS total_visits,
          (SELECT COUNT(*) FROM vehicles   WHERE tenant_id = ${tid}) AS total_vehicles,
          (SELECT COUNT(*) FROM documents  WHERE tenant_id = ${tid}) AS total_documents,
          (SELECT COUNT(*) FROM vendors    WHERE tenant_id = ${tid}) AS total_vendors
      `),
      this.prisma.$queryRaw<Row[]>(Prisma.sql`
        SELECT
          (SELECT COUNT(*) FROM visits            WHERE tenant_id = ${tid} AND status = 'checked_in')                  AS active_visits,
          (SELECT COUNT(*) FROM users             WHERE tenant_id = ${tid} AND is_active = true)                       AS active_users,
          (SELECT COUNT(*) FROM staff             WHERE tenant_id = ${tid} AND is_active = true)                       AS active_staff,
          (SELECT COUNT(*) FROM maintenance       WHERE tenant_id = ${tid} AND status = 'open')                        AS open_maintenance,
          (SELECT COUNT(*) FROM projects          WHERE tenant_id = ${tid} AND status = 'active')                      AS active_projects,
          (SELECT COUNT(*) FROM calendar_events   WHERE tenant_id = ${tid} AND start_at >= NOW())                      AS upcoming_events,
          (SELECT COUNT(*) FROM compliance_items  WHERE tenant_id = ${tid} AND status = 'pending')                     AS pending_compliance,
          (SELECT COUNT(*) FROM packages          WHERE tenant_id = ${tid} AND status IN ('received', 'notified'))     AS pending_packages,
          (SELECT COUNT(*) FROM bolos             WHERE tenant_id = ${tid} AND status = 'active')                      AS active_bolos,
          (SELECT COUNT(*) FROM violations        WHERE tenant_id = ${tid} AND status = 'open')                        AS open_violations,
          (SELECT COUNT(*) FROM tasks             WHERE tenant_id = ${tid} AND status IN ('todo', 'in_progress'))      AS pending_tasks
      `),
      this.prisma.$queryRaw<Row[]>(Prisma.sql`
        SELECT
          COUNT(*)                                    AS total_units,
          COUNT(*) FILTER (WHERE status = 'occupied') AS occupied_units,
          COUNT(*) FILTER (WHERE status = 'vacant')   AS vacant_units
        FROM units WHERE tenant_id = ${tid}
      `),
    ]);

    const t = totals[0];
    const f = filtered[0];
    const u = units[0];

    const result = {
      totalVisitors:     Number(t.total_visitors),
      totalVisits:       Number(t.total_visits),
      activeVisits:      Number(f.active_visits),
      totalUsers:        Number(f.active_users),
      totalStaff:        Number(f.active_staff),
      totalVehicles:     Number(t.total_vehicles),
      openMaintenance:   Number(f.open_maintenance),
      activeProjects:    Number(f.active_projects),
      upcomingEvents:    Number(f.upcoming_events),
      pendingCompliance: Number(f.pending_compliance),
      totalDocuments:    Number(t.total_documents),
      totalVendors:      Number(t.total_vendors),
      pendingPackages:   Number(f.pending_packages),
      activeBolos:       Number(f.active_bolos),
      openViolations:    Number(f.open_violations),
      pendingTasks:      Number(f.pending_tasks),
      totalUnits:        Number(u.total_units),
      occupiedUnits:     Number(u.occupied_units),
      vacantUnits:       Number(u.vacant_units),
    };

    await this.cache.set(cacheKey, result, ReportsService.DASHBOARD_TTL);
    return result;
  }

  // ── 1. Visit Log Report ──────────────────────────────────────────

  async getVisitLogReport(tenantId: string, dto: ReportQueryDto) {
    const where: any = { tenantId };
    if (dto.from || dto.to) {
      where.createdAt = {};
      if (dto.from) where.createdAt.gte = new Date(dto.from);
      if (dto.to) where.createdAt.lte = new Date(dto.to);
    }
    if (dto.status) where.status = dto.status;
    if (dto.search?.trim()) {
      where.OR = [
        { visitor: { firstName: { contains: dto.search.trim(), mode: 'insensitive' } } },
        { visitor: { lastName: { contains: dto.search.trim(), mode: 'insensitive' } } },
        { purpose: { contains: dto.search.trim(), mode: 'insensitive' } },
        { location: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        include: {
          visitor: true,
          hostUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      this.prisma.visit.count({ where }),
    ]);
    return { rows, total };
  }

  // ── 2. Visitors Report ───────────────────────────────────────────

  async getVisitorsReport(tenantId: string, dto: ReportQueryDto) {
    const where: any = { tenantId };
    if (dto.search?.trim()) {
      where.OR = [
        { firstName: { contains: dto.search.trim(), mode: 'insensitive' } },
        { lastName: { contains: dto.search.trim(), mode: 'insensitive' } },
        { company: { contains: dto.search.trim(), mode: 'insensitive' } },
        { email: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.visitor.findMany({
        where,
        include: { _count: { select: { visits: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      this.prisma.visitor.count({ where }),
    ]);
    return { rows, total };
  }

  // ── 3. Resident Report ───────────────────────────────────────────

  async getResidentReport(tenantId: string, dto: ReportQueryDto) {
    const where: any = { tenantId };
    if (dto.status === 'active') where.isActive = true;
    else if (dto.status === 'inactive') where.isActive = false;
    if (dto.unitId) where.unitId = dto.unitId;
    if (dto.extra) where.residentType = dto.extra; // e.g. 'owner', 'renter'
    if (dto.search?.trim()) {
      where.OR = [
        { firstName: { contains: dto.search.trim(), mode: 'insensitive' } },
        { lastName: { contains: dto.search.trim(), mode: 'insensitive' } },
        { email: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, firstName: true, lastName: true, email: true,
          phone: true, mobile: true, isActive: true, residentType: true,
          isBoardMember: true, isHandicapped: true, movingDate: true,
          leaseBeginDate: true, leaseEndDate: true, createdAt: true,
          unit: { select: { id: true, unitNumber: true, building: true } },
        },
        orderBy: { lastName: 'asc' },
        take: 1000,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { rows, total };
  }

  // ── 4. Staff Report ──────────────────────────────────────────────

  async getStaffReport(tenantId: string, dto: ReportQueryDto) {
    const where: any = { tenantId };
    if (dto.status === 'active') where.isActive = true;
    else if (dto.status === 'inactive') where.isActive = false;
    if (dto.extra) where.department = dto.extra;
    if (dto.search?.trim()) {
      where.OR = [
        { firstName: { contains: dto.search.trim(), mode: 'insensitive' } },
        { lastName: { contains: dto.search.trim(), mode: 'insensitive' } },
        { email: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        orderBy: { lastName: 'asc' },
        take: 1000,
      }),
      this.prisma.staff.count({ where }),
    ]);
    return { rows, total };
  }

  // ── 5. Vehicle Report ────────────────────────────────────────────

  async getVehicleReport(tenantId: string, dto: ReportQueryDto) {
    const where: any = { tenantId };
    if (dto.status) where.ownerType = dto.status; // reuse status field for ownerType filter
    if (dto.unitId) where.unitId = dto.unitId;
    if (dto.search?.trim()) {
      where.OR = [
        { plateNumber: { contains: dto.search.trim(), mode: 'insensitive' } },
        { make: { contains: dto.search.trim(), mode: 'insensitive' } },
        { model: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        include: { unit: { select: { unitNumber: true, building: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return { rows, total };
  }

  // ── 6. Maintenance Report ────────────────────────────────────────

  async getMaintenanceReport(tenantId: string, dto: ReportQueryDto) {
    const where: any = { tenantId };
    if (dto.status) where.status = dto.status;
    if (dto.unitId) where.unitId = dto.unitId;
    if (dto.from || dto.to) {
      where.createdAt = {};
      if (dto.from) where.createdAt.gte = new Date(dto.from);
      if (dto.to) where.createdAt.lte = new Date(dto.to);
    }
    if (dto.search?.trim()) {
      where.OR = [
        { title: { contains: dto.search.trim(), mode: 'insensitive' } },
        { description: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.maintenance.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          unit: { select: { unitNumber: true, building: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      this.prisma.maintenance.count({ where }),
    ]);
    return { rows, total };
  }

  // ── 7. Package Report ────────────────────────────────────────────

  async getPackageReport(tenantId: string, dto: ReportQueryDto) {
    const where: any = { tenantId };
    if (dto.status) where.status = dto.status;
    if (dto.unitId) where.unitId = dto.unitId;
    if (dto.from || dto.to) {
      where.receivedAt = {};
      if (dto.from) where.receivedAt.gte = new Date(dto.from);
      if (dto.to) where.receivedAt.lte = new Date(dto.to);
    }
    if (dto.search?.trim()) {
      where.OR = [
        { trackingNumber: { contains: dto.search.trim(), mode: 'insensitive' } },
        { recipientName: { contains: dto.search.trim(), mode: 'insensitive' } },
        { carrier: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.package.findMany({
        where,
        include: {
          recipient: { select: { id: true, firstName: true, lastName: true } },
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
          pickedUpBy: { select: { id: true, firstName: true, lastName: true } },
          unit: { select: { unitNumber: true, building: true } },
        },
        orderBy: { receivedAt: 'desc' },
        take: 1000,
      }),
      this.prisma.package.count({ where }),
    ]);
    return { rows, total };
  }

  // ── 8. Violation Report ──────────────────────────────────────────

  async getViolationReport(tenantId: string, dto: ReportQueryDto) {
    const where: any = { tenantId };
    if (dto.status) where.status = dto.status;
    if (dto.unitId) where.unitId = dto.unitId;
    if (dto.extra) where.type = dto.extra; // violationType filter
    if (dto.from || dto.to) {
      where.issuedDate = {};
      if (dto.from) where.issuedDate.gte = new Date(dto.from);
      if (dto.to) where.issuedDate.lte = new Date(dto.to);
    }
    if (dto.search?.trim()) {
      where.OR = [
        { title: { contains: dto.search.trim(), mode: 'insensitive' } },
        { description: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.violation.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          unit: { select: { unitNumber: true, building: true } },
        },
        orderBy: { issuedDate: 'desc' },
        take: 1000,
      }),
      this.prisma.violation.count({ where }),
    ]);
    return { rows, total };
  }

  // ── 9. Unit Occupancy Report ─────────────────────────────────────

  async getUnitOccupancyReport(tenantId: string, dto: ReportQueryDto) {
    const where: any = { tenantId };
    if (dto.status) where.status = dto.status;
    if (dto.search?.trim()) {
      where.OR = [
        { unitNumber: { contains: dto.search.trim(), mode: 'insensitive' } },
        { building: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.unit.findMany({
        where,
        include: {
          _count: { select: { residents: true, vehicles: true, packages: true, maintenance: true, violations: true } },
          residents: { select: { id: true, firstName: true, lastName: true, residentType: true }, take: 10 },
        },
        orderBy: { unitNumber: 'asc' },
        take: 1000,
      }),
      this.prisma.unit.count({ where }),
    ]);
    return { rows, total };
  }

  // ── 10. Compliance Report ────────────────────────────────────────

  async getComplianceReport(tenantId: string, dto: ReportQueryDto) {
    const where: any = { tenantId };
    if (dto.status) where.status = dto.status;
    if (dto.from || dto.to) {
      where.dueDate = {};
      if (dto.from) where.dueDate.gte = new Date(dto.from);
      if (dto.to) where.dueDate.lte = new Date(dto.to);
    }
    if (dto.search?.trim()) {
      where.OR = [
        { name: { contains: dto.search.trim(), mode: 'insensitive' } },
        { category: { contains: dto.search.trim(), mode: 'insensitive' } },
        { notes: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.complianceItem.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        take: 1000,
      }),
      this.prisma.complianceItem.count({ where }),
    ]);
    return { rows, total };
  }

  // ── 11. Vendor Report ────────────────────────────────────────────

  async getVendorReport(tenantId: string, dto: ReportQueryDto) {
    const where: any = { tenantId };
    if (dto.extra) where.category = dto.extra;
    if (dto.search?.trim()) {
      where.OR = [
        { name: { contains: dto.search.trim(), mode: 'insensitive' } },
        { contactName: { contains: dto.search.trim(), mode: 'insensitive' } },
        { email: { contains: dto.search.trim(), mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        orderBy: { name: 'asc' },
        take: 1000,
      }),
      this.prisma.vendor.count({ where }),
    ]);
    return { rows, total };
  }

  // ── 12. Evacuation / Fire Roll Call Report ───────────────────────

  async getEvacuationReport(tenantId: string) {
    const [activeVisits, activeResidents] = await Promise.all([
      this.prisma.visit.findMany({
        where: { tenantId, status: 'checked_in' },
        include: {
          visitor: { select: { firstName: true, lastName: true, phone: true, company: true } },
          hostUser: { select: { firstName: true, lastName: true } },
        },
        orderBy: { checkInAt: 'desc' },
      }),
      this.prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: {
          id: true, firstName: true, lastName: true, phone: true, mobile: true,
          unit: { select: { unitNumber: true, building: true } },
        },
        orderBy: { lastName: 'asc' },
      }),
    ]);

    const rows = [
      ...activeVisits.map((v) => ({
        personType: 'Visitor' as const,
        name: `${v.visitor.firstName} ${v.visitor.lastName}`.trim(),
        location: v.location ?? v.visitor.company ?? '—',
        checkInTime: v.checkInAt,
        contact: v.hostUser
          ? `${v.hostUser.firstName} ${v.hostUser.lastName}`.trim()
          : '—',
        phone: v.visitor.phone ?? '—',
      })),
      ...activeResidents.map((r) => ({
        personType: 'Resident' as const,
        name: `${r.firstName} ${r.lastName}`.trim(),
        location: r.unit
          ? `Unit ${r.unit.unitNumber}${r.unit.building ? `, ${r.unit.building}` : ''}`
          : '—',
        checkInTime: null,
        contact: '—',
        phone: r.phone ?? r.mobile ?? '—',
      })),
    ];

    return {
      rows,
      total: rows.length,
      summary: {
        activeVisitors: activeVisits.length,
        activeResidents: activeResidents.length,
      },
    };
  }

  // ── Dispatch helper for processor ────────────────────────────────

  async runReport(
    reportType: string,
    tenantId: string,
    dto: ReportQueryDto,
  ): Promise<{ rows: unknown[]; total: number }> {
    switch (reportType) {
      case 'visit-log':
        return this.getVisitLogReport(tenantId, dto);
      case 'visitors':
        return this.getVisitorsReport(tenantId, dto);
      case 'residents':
        return this.getResidentReport(tenantId, dto);
      case 'staff':
        return this.getStaffReport(tenantId, dto);
      case 'vehicles':
        return this.getVehicleReport(tenantId, dto);
      case 'maintenance':
        return this.getMaintenanceReport(tenantId, dto);
      case 'packages':
        return this.getPackageReport(tenantId, dto);
      case 'violations':
        return this.getViolationReport(tenantId, dto);
      case 'unit-occupancy':
        return this.getUnitOccupancyReport(tenantId, dto);
      case 'compliance':
        return this.getComplianceReport(tenantId, dto);
      case 'vendors':
        return this.getVendorReport(tenantId, dto);
      case 'evacuation':
        return this.getEvacuationReport(tenantId);
      default:
        throw new Error(`Unknown report type: ${reportType}`);
    }
  }
}
