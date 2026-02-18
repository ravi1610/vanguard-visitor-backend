import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getVisitsReport(tenantId: string, from?: string, to?: string) {
    const where: { tenantId: string; createdAt?: object } = { tenantId };
    if (from || to) {
      where.createdAt = {};
      if (from)
        (where.createdAt as Record<string, unknown>).gte = new Date(from);
      if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to);
    }
    const [visits, total, byStatus] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        include: {
          visitor: true,
          hostUser: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 500,
      }),
      this.prisma.visit.count({ where }),
      this.prisma.visit.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      }),
    ]);
    return {
      total,
      byStatus: byStatus.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count.id }),
        {} as Record<string, number>,
      ),
      recent: visits,
    };
  }

  /**
   * Dashboard stats — consolidated from 19 Prisma counts into 3 raw SQL queries.
   * Table/column names match @@map annotations in schema.prisma.
   */
  async getDashboardStats(tenantId: string) {
    type Row = Record<string, bigint>;
    const tid = tenantId;

    const [totals, filtered, units] = await Promise.all([
      // Query 1: Simple tenant-scoped totals (no status filter)
      this.prisma.$queryRaw<Row[]>(Prisma.sql`
        SELECT
          (SELECT COUNT(*) FROM visitors   WHERE tenant_id = ${tid}) AS total_visitors,
          (SELECT COUNT(*) FROM visits     WHERE tenant_id = ${tid}) AS total_visits,
          (SELECT COUNT(*) FROM vehicles   WHERE tenant_id = ${tid}) AS total_vehicles,
          (SELECT COUNT(*) FROM documents  WHERE tenant_id = ${tid}) AS total_documents,
          (SELECT COUNT(*) FROM vendors    WHERE tenant_id = ${tid}) AS total_vendors
      `),
      // Query 2: Status/condition filtered counts
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
      // Query 3: Unit breakdown
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

    return {
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
  }

  async getVisitorsReport(tenantId: string, search?: string) {
    const where: { tenantId: string; OR?: object[] } = { tenantId };
    if (search?.trim()) {
      where.OR = [
        { firstName: { contains: search.trim(), mode: 'insensitive' } },
        { lastName: { contains: search.trim(), mode: 'insensitive' } },
        { company: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }
    const [visitors, total] = await Promise.all([
      this.prisma.visitor.findMany({
        where,
        include: { _count: { select: { visits: true } } },
        orderBy: [{ createdAt: 'desc' }],
        take: 500,
      }),
      this.prisma.visitor.count({ where: { tenantId } }),
    ]);
    return { total, visitors };
  }
}
