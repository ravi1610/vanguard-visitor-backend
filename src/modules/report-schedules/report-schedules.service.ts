import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { CreateReportScheduleDto } from './dto/create-report-schedule.dto.js';
import { UpdateReportScheduleDto } from './dto/update-report-schedule.dto.js';

@Injectable()
export class ReportSchedulesService {
  private readonly logger = new Logger(ReportSchedulesService.name);

  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
  ) {}

  // ── CRUD ─────────────────────────────────────────────────────────

  async findAll(tenantId: string) {
    return this.prisma.reportSchedule.findMany({
      where: { tenantId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const schedule = await this.prisma.reportSchedule.findFirst({
      where: { id, tenantId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!schedule) throw new NotFoundException(`Schedule ${id} not found`);
    return schedule;
  }

  async create(tenantId: string, userId: string, dto: CreateReportScheduleDto) {
    const nextRun = this.computeNextRun(dto.cronExpr, dto.timezone ?? 'America/New_York');
    return this.prisma.reportSchedule.create({
      data: {
        tenantId,
        createdById: userId,
        name: dto.name,
        reportType: dto.reportType,
        filters: (dto.filters ?? {}) as any,
        cronExpr: dto.cronExpr,
        timezone: dto.timezone ?? 'America/New_York',
        recipients: dto.recipients,
        format: dto.format ?? 'pdf',
        isActive: dto.isActive ?? true,
        nextRunAt: nextRun,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateReportScheduleDto) {
    await this.findOne(tenantId, id);
    const data: any = { ...dto };
    if (dto.filters) data.filters = dto.filters;
    if (dto.cronExpr) {
      data.nextRunAt = this.computeNextRun(dto.cronExpr, dto.timezone ?? 'America/New_York');
    }
    return this.prisma.reportSchedule.update({ where: { id }, data });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.reportSchedule.delete({ where: { id } });
  }

  // ── Cron: check for due schedules every 5 minutes ─────────────

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processScheduledReports() {
    const now = new Date();
    const dueSchedules = await this.prisma.reportSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      take: 10, // batch size
    });

    for (const schedule of dueSchedules) {
      try {
        this.logger.log(`Running scheduled report: ${schedule.name} (${schedule.reportType})`);

        // Generate report data
        const filters = (schedule.filters as Record<string, string | undefined>) ?? {};
        const result = await this.reportsService.runReport(
          schedule.reportType,
          schedule.tenantId,
          filters,
        );

        // Send email with report
        await this.sendReportEmail(schedule, result);

        // Update lastRunAt and compute nextRunAt
        const nextRun = this.computeNextRun(schedule.cronExpr, schedule.timezone);
        await this.prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { lastRunAt: now, nextRunAt: nextRun },
        });

        this.logger.log(`Scheduled report sent: ${schedule.name} → ${schedule.recipients.join(', ')}`);
      } catch (err) {
        this.logger.error(`Failed to process schedule ${schedule.id}: ${err}`);
        // Push nextRunAt forward to avoid retrying in a loop
        const nextRun = this.computeNextRun(schedule.cronExpr, schedule.timezone);
        await this.prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { nextRunAt: nextRun },
        });
      }
    }
  }

  // ── Email helper ──────────────────────────────────────────────

  private async sendReportEmail(
    schedule: { name: string; reportType: string; recipients: string[]; format: string; tenantId: string },
    result: { rows: unknown[]; total: number },
  ) {
    // Dynamically import nodemailer to avoid startup cost
    const nodemailer = await import('nodemailer');

    // Fetch email settings from system settings
    const settings = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['email.host', 'email.port', 'email.username', 'email.password', 'email.from', 'email.provider'],
        },
      },
    });
    const cfg: Record<string, string> = {};
    for (const s of settings) cfg[s.key] = s.value;

    if (!cfg['email.host'] || !cfg['email.username']) {
      this.logger.warn('Email not configured – skipping scheduled report email');
      return;
    }

    const transporter = nodemailer.default.createTransport({
      host: cfg['email.host'],
      port: parseInt(cfg['email.port'] ?? '587'),
      secure: cfg['email.port'] === '465',
      auth: { user: cfg['email.username'], pass: cfg['email.password'] },
    });

    // Build CSV attachment
    const csvRows = result.rows as Record<string, unknown>[];
    let csvContent = '';
    if (csvRows.length > 0) {
      const headers = Object.keys(csvRows[0]);
      csvContent = headers.join(',') + '\n';
      for (const row of csvRows) {
        csvContent += headers.map((h) => {
          const val = row[h];
          const str = val != null ? String(val) : '';
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',') + '\n';
      }
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${schedule.reportType}-report-${timestamp}.csv`;

    await transporter.sendMail({
      from: cfg['email.from'] ?? cfg['email.username'],
      to: schedule.recipients.join(', '),
      subject: `Scheduled Report: ${schedule.name}`,
      html: `
        <h2>Scheduled Report: ${schedule.name}</h2>
        <p>Report type: <strong>${schedule.reportType}</strong></p>
        <p>Records: <strong>${result.total}</strong></p>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Please find the report attached.</p>
        <br>
        <p style="color:#888;font-size:12px;">— Vanguard Visitor</p>
      `,
      attachments: [
        {
          filename,
          content: csvContent,
          contentType: 'text/csv',
        },
      ],
    });
  }

  // ── Cron expression → next run date ───────────────────────────

  private computeNextRun(cronExpr: string, _timezone: string): Date {
    // Simple cron parsing for common patterns
    // Format: minute hour dayOfMonth month dayOfWeek
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length !== 5) {
      // Default to 1 hour from now if invalid
      return new Date(Date.now() + 60 * 60 * 1000);
    }

    const now = new Date();
    const [min, hour, dom, _month, dow] = parts;

    // Simple daily schedule: "0 8 * * *" → next 8:00 AM
    if (min !== '*' && hour !== '*' && dom === '*' && dow === '*') {
      const next = new Date(now);
      next.setHours(parseInt(hour), parseInt(min), 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next;
    }

    // Weekly schedule: "0 8 * * 1" → next Monday 8:00 AM
    if (min !== '*' && hour !== '*' && dom === '*' && dow !== '*') {
      const targetDay = parseInt(dow);
      const next = new Date(now);
      next.setHours(parseInt(hour), parseInt(min), 0, 0);
      const daysUntil = (targetDay - now.getDay() + 7) % 7;
      if (daysUntil === 0 && next <= now) {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + daysUntil);
      }
      return next;
    }

    // Monthly schedule: "0 8 1 * *" → 1st of next month at 8:00 AM
    if (min !== '*' && hour !== '*' && dom !== '*' && dow === '*') {
      const next = new Date(now);
      next.setDate(parseInt(dom));
      next.setHours(parseInt(hour), parseInt(min), 0, 0);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      return next;
    }

    // Default: 24 hours from now
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
}
