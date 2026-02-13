import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Reports')
@ApiBearerAuth('JWT')
@Controller('reports')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  @Get('dashboard')
  @UseGuards(PermissionsGuard)
  @Permissions('visit.view')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  dashboard(@CurrentUser('tenantId') tenantId: string) {
    return this.reports.getDashboardStats(tenantId);
  }

  @Get('visits')
  @UseGuards(PermissionsGuard)
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get visits report with date range' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO 8601)' })
  getVisitsReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.getVisitsReport(tenantId, from, to);
  }

  @Get('visitors')
  @UseGuards(PermissionsGuard)
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get visitors report with search' })
  @ApiQuery({ name: 'search', required: false, description: 'Search visitors by name' })
  getVisitorsReport(
    @CurrentUser('tenantId') tenantId: string,
    @Query('search') search?: string,
  ) {
    return this.reports.getVisitorsReport(tenantId, search);
  }
}
