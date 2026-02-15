import { Injectable } from '@nestjs/common';
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

  async getDashboardStats(tenantId: string) {
    const [
      totalVisitors,
      totalVisits,
      activeVisits,
      totalUsers,
      totalStaff,
      totalVehicles,
      openMaintenance,
      activeProjects,
      upcomingEvents,
      pendingCompliance,
      totalDocuments,
      totalVendors,
      pendingPackages,
      activeBolos,
    ] = await Promise.all([
      this.prisma.visitor.count({ where: { tenantId } }),
      this.prisma.visit.count({ where: { tenantId } }),
      this.prisma.visit.count({ where: { tenantId, status: 'checked_in' } }),
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
      this.prisma.staff.count({ where: { tenantId, isActive: true } }),
      this.prisma.vehicle.count({ where: { tenantId } }),
      this.prisma.maintenance.count({ where: { tenantId, status: 'open' } }),
      this.prisma.project.count({ where: { tenantId, status: 'active' } }),
      this.prisma.calendarEvent.count({ where: { tenantId, startAt: { gte: new Date() } } }),
      this.prisma.complianceItem.count({ where: { tenantId, status: 'pending' } }),
      this.prisma.document.count({ where: { tenantId } }),
      this.prisma.vendor.count({ where: { tenantId } }),
      this.prisma.package.count({ where: { tenantId, status: { in: ['received', 'notified'] } } }),
      this.prisma.bolo.count({ where: { tenantId, status: 'active' } }),
    ]);
    return {
      totalVisitors,
      totalVisits,
      activeVisits,
      totalUsers,
      totalStaff,
      totalVehicles,
      openMaintenance,
      activeProjects,
      upcomingEvents,
      pendingCompliance,
      totalDocuments,
      totalVendors,
      pendingPackages,
      activeBolos,
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
