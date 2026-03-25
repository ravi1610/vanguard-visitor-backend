import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { ResidentService } from './resident.service';
import { ResidentScheduleVisitDto } from './dto/schedule-visit.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ResidentCreateMaintenanceDto } from './dto/resident-create-maintenance.dto';

@ApiTags('Resident')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('resident')
export class ResidentController {
  constructor(private resident: ResidentService) {}

  // ── Dashboard ────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Get resident dashboard summary' })
  dashboard(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.resident.getDashboard(tenantId, userId);
  }

  // ── Profile ──────────────────────────────────────────────

  @Get('profile')
  @ApiOperation({ summary: 'Get own profile with relations' })
  getProfile(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.resident.getProfile(tenantId, userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update own phone/mobile' })
  updateProfile(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.resident.updateProfile(tenantId, userId, dto);
  }

  // ── Visitors ─────────────────────────────────────────────

  @Get('visitors')
  @ApiOperation({ summary: 'List own visits (paginated)' })
  @ApiQuery({ name: 'status', required: false })
  getVisitors(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
  ) {
    return this.resident.getVisitors(tenantId, userId, query, status);
  }

  @Post('visitors/schedule')
  @ApiOperation({ summary: 'Schedule a new visit and send invite' })
  scheduleVisit(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: ResidentScheduleVisitDto,
  ) {
    return this.resident.scheduleVisit(tenantId, userId, dto);
  }

  @Get('visitors/:id')
  @ApiOperation({ summary: 'Get single visit detail' })
  getVisitorDetail(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.resident.getVisitorDetail(tenantId, userId, id);
  }

  @Patch('visitors/:id/cancel')
  @ApiOperation({ summary: 'Cancel a scheduled visit' })
  cancelVisit(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.resident.cancelVisit(tenantId, userId, id);
  }

  // ── Packages ─────────────────────────────────────────────

  @Get('packages')
  @ApiOperation({ summary: 'List own packages (paginated)' })
  @ApiQuery({ name: 'status', required: false })
  getPackages(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
  ) {
    return this.resident.getPackages(tenantId, userId, query, status);
  }

  @Get('packages/:id')
  @ApiOperation({ summary: 'Get single package detail' })
  getPackageDetail(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.resident.getPackageDetail(tenantId, userId, id);
  }

  // ── Maintenance ──────────────────────────────────────────

  @Get('maintenance')
  @ApiOperation({ summary: 'List own maintenance requests (paginated)' })
  @ApiQuery({ name: 'status', required: false })
  getMaintenanceRequests(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
  ) {
    return this.resident.getMaintenanceRequests(tenantId, userId, query, status);
  }

  @Post('maintenance')
  @ApiOperation({ summary: 'Create a maintenance work order' })
  createMaintenance(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: ResidentCreateMaintenanceDto,
  ) {
    return this.resident.createMaintenanceRequest(tenantId, userId, dto);
  }

  @Get('maintenance/:id')
  @ApiOperation({ summary: 'Get single maintenance request detail' })
  getMaintenanceDetail(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.resident.getMaintenanceDetail(tenantId, userId, id);
  }

  // ── Documents ────────────────────────────────────────────

  @Get('documents')
  @ApiOperation({ summary: 'List documents uploaded by this resident (paginated)' })
  getDocuments(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Query() query: PagedQueryDto,
  ) {
    return this.resident.getDocuments(tenantId, userId, query);
  }

  @Get('documents/global')
  @ApiOperation({ summary: 'List global (tenant-wide) documents visible to residents (paginated)' })
  getGlobalDocuments(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
  ) {
    return this.resident.getGlobalDocuments(tenantId, query);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get single document detail' })
  getDocumentDetail(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.resident.getDocumentDetail(tenantId, userId, id);
  }

  @Get('documents/global/:id')
  @ApiOperation({ summary: 'Get a single global (tenant-wide) document detail' })
  getGlobalDocumentDetail(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.resident.getGlobalDocumentDetail(tenantId, id);
  }

  // ── Compliance ───────────────────────────────────────────

  @Get('compliance')
  @ApiOperation({ summary: 'List tenant-wide compliance items (paginated)' })
  @ApiQuery({ name: 'status', required: false })
  getCompliance(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
  ) {
    return this.resident.getCompliance(tenantId, query, status);
  }

  @Get('compliance/:id')
  @ApiOperation({ summary: 'Get single compliance item (read-only)' })
  getComplianceDetail(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.resident.getComplianceDetail(tenantId, id);
  }

  // ── Vehicles ─────────────────────────────────────────────

  @Get('vehicles')
  @ApiOperation({ summary: 'List vehicles registered to this resident or their unit' })
  getVehicles(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Query() query: PagedQueryDto,
  ) {
    return this.resident.getVehicles(tenantId, userId, query);
  }

  @Get('vehicles/:id')
  @ApiOperation({ summary: 'Get vehicle detail' })
  getVehicleDetail(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.resident.getVehicleDetail(tenantId, userId, id);
  }

  // ── Calendar (read-only) ─────────────────────────────────

  @Get('calendar')
  @ApiOperation({ summary: 'List calendar events for the tenant (read-only)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getCalendar(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.resident.getCalendarEvents(tenantId, query, from, to);
  }

  @Get('calendar/:id')
  @ApiOperation({ summary: 'Get calendar event detail (read-only)' })
  getCalendarDetail(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.resident.getCalendarEventDetail(tenantId, id);
  }
}