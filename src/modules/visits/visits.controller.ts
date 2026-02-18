import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { VisitsService } from './visits.service';
import { CheckInDto } from './dto/checkin.dto';
import { ScheduleVisitDto } from './dto/schedule-visit.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VisitStatus } from '@prisma/client';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Visits')
@ApiBearerAuth('JWT')
@Controller('visits')
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(
    private visits: VisitsService,
    private config: ConfigService,
  ) {}

  private get qrSecret(): string {
    return this.config.get<string>('QR_SECRET') || 'vanguard-dev-qr-secret';
  }

  private get appUrl(): string {
    return this.config.get<string>('app.url') || 'http://localhost:5173';
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('visit.view')
  @ApiOperation({ summary: 'List all visits with pagination and filters' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter (ISO 8601)' })
  @ApiQuery({ name: 'status', required: false, description: 'Visit status filter (active, checked_in, checked_out, cancelled)' })
  @ApiQuery({ name: 'hostUserId', required: false, description: 'Filter by host user ID' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('hostUserId') hostUserId?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    // Map frontend "active" filter to checked_in
    const statusFilter =
      status === 'active'
        ? VisitStatus.checked_in
        : (status as VisitStatus | undefined);
    return this.visits.findAll(tenantId, query, {
      from: fromDate,
      to: toDate,
      status: statusFilter,
      hostUserId,
    });
  }

  @Get('active')
  @UseGuards(PermissionsGuard)
  @Permissions('visit.view')
  @ApiOperation({ summary: 'List currently active (checked-in) visits' })
  findActive(@CurrentUser('tenantId') tenantId: string) {
    return this.visits.findActive(tenantId);
  }

  @Post('checkin')
  @UseGuards(PermissionsGuard)
  @Permissions('visit.checkin')
  @ApiOperation({ summary: 'Check in a visitor' })
  checkIn(@CurrentUser('tenantId') tenantId: string, @Body() dto: CheckInDto) {
    return this.visits.checkIn(tenantId, dto);
  }

  @Post('schedule')
  @UseGuards(PermissionsGuard)
  @Permissions('visit.checkin')
  @ApiOperation({ summary: 'Schedule a visit (optionally generate QR code)' })
  schedule(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: ScheduleVisitDto,
  ) {
    return this.visits.schedule(tenantId, dto, this.qrSecret, this.appUrl);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('public-scan')
  @ApiOperation({ summary: 'Public QR scan — check in visitor without auth (rate-limited)' })
  publicScan(@Body() body: { token: string }) {
    return this.visits.publicScanQr(body.token, this.qrSecret);
  }

  @Post('scan-qr')
  @UseGuards(PermissionsGuard)
  @Permissions('visit.checkin')
  @ApiOperation({ summary: 'Scan a QR code to check in a visitor' })
  scanQr(
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { token: string },
  ) {
    return this.visits.scanQr(tenantId, body.token, this.qrSecret);
  }

  @Post(':id/generate-qr')
  @UseGuards(PermissionsGuard)
  @Permissions('visit.checkin')
  @ApiOperation({ summary: 'Generate a QR code for a scheduled visit' })
  generateQr(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.visits.generateQr(tenantId, id, this.qrSecret, this.appUrl);
  }

  @Post(':id/checkout')
  @UseGuards(PermissionsGuard)
  @Permissions('visit.checkout')
  @ApiOperation({ summary: 'Check out a visitor' })
  checkout(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.visits.checkout(tenantId, id);
  }
}
