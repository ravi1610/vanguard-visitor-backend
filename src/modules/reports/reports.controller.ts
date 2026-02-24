import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Optional,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Reports')
@ApiBearerAuth('JWT')
@Controller('reports')
export class ReportsController {
  private readonly hasQueue: boolean;

  constructor(
    private reports: ReportsService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    @Optional() @InjectQueue('reports') private reportsQueue?: Queue,
  ) {
    this.hasQueue = !!this.reportsQueue;
  }

  // ── Dashboard (existing, unchanged) ──────────────────────────────

  @Get('dashboard')
  @UseGuards(PermissionsGuard)
  @Permissions('visit.view')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  dashboard(@CurrentUser('tenantId') tenantId: string) {
    return this.reports.getDashboardStats(tenantId);
  }

  // ── Generic generate endpoint ────────────────────────────────────

  @Post('generate/:reportType')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Generate a report (async with Redis, sync fallback)' })
  @ApiBody({ type: ReportQueryDto })
  async generate(
    @CurrentUser('tenantId') tenantId: string,
    @Param('reportType') reportType: string,
    @Body() dto: ReportQueryDto,
  ) {
    // Validate report type
    const validTypes = [
      'visit-log',
      'visitors',
      'residents',
      'staff',
      'vehicles',
      'maintenance',
      'packages',
      'violations',
      'unit-occupancy',
      'compliance',
      'vendors',
      'evacuation',
      'visitor-time-spent',
      'visitor-activity-24h',
      'emergency-contacts',
      'resident-vehicles',
      'pet-registry',
    ];
    if (!validTypes.includes(reportType)) {
      throw new NotFoundException(`Unknown report type: ${reportType}`);
    }

    // Async mode: queue the job
    if (this.hasQueue && this.reportsQueue) {
      const job = await this.reportsQueue.add('generate', {
        reportType,
        tenantId,
        filters: dto,
      });
      return { jobId: job.id, async: true };
    }

    // Sync fallback: run directly
    const result = await this.reports.runReport(reportType, tenantId, dto);
    return { ...result, async: false };
  }

  // ── Job status polling ───────────────────────────────────────────

  @Get('jobs/:jobId/status')
  @UseGuards(PermissionsGuard)
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Check report generation job status' })
  async jobStatus(@Param('jobId') jobId: string) {
    if (!this.hasQueue || !this.reportsQueue) {
      throw new NotFoundException('Queue not available (Redis not configured)');
    }

    const job = await this.reportsQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    return {
      jobId,
      status: state,
      progress: job.progress ?? 0,
    };
  }

  // ── Job result retrieval ─────────────────────────────────────────

  @Get('jobs/:jobId/result')
  @UseGuards(PermissionsGuard)
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get completed report result' })
  async jobResult(@Param('jobId') jobId: string) {
    if (!this.hasQueue || !this.reportsQueue) {
      throw new NotFoundException('Queue not available (Redis not configured)');
    }

    const job = await this.reportsQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    if (state !== 'completed') {
      return { status: state, rows: [], total: 0 };
    }

    const cacheKey = `report:result:${jobId}`;
    const result = await this.cache.get(cacheKey);
    if (!result) {
      throw new NotFoundException('Report result expired or not found');
    }

    return result;
  }

  // ── Legacy endpoints (backward compat — redirect to generate) ───

  @Get('visits')
  @UseGuards(PermissionsGuard)
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get visits report (legacy)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getVisitsReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getVisitLogReport(tenantId, { from, to });
  }

  @Get('visitors')
  @UseGuards(PermissionsGuard)
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get visitors report (legacy)' })
  @ApiQuery({ name: 'search', required: false })
  getVisitorsReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query('search') search?: string,
  ) {
    return this.reports.getVisitorsReport(tenantId, { search });
  }
}
