import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportSchedulesService } from './report-schedules.service.js';
import { CreateReportScheduleDto } from './dto/create-report-schedule.dto.js';
import { UpdateReportScheduleDto } from './dto/update-report-schedule.dto.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Report Schedules')
@ApiBearerAuth('JWT')
@Controller('report-schedules')
export class ReportSchedulesController {
  constructor(private schedules: ReportSchedulesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('reports.view')
  @ApiOperation({ summary: 'List report schedules' })
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.schedules.findAll(tenantId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('reports.view')
  @ApiOperation({ summary: 'Get a report schedule' })
  findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.schedules.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('reports.manage')
  @ApiOperation({ summary: 'Create a report schedule' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateReportScheduleDto,
  ) {
    return this.schedules.create(tenantId, userId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('reports.manage')
  @ApiOperation({ summary: 'Update a report schedule' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReportScheduleDto,
  ) {
    return this.schedules.update(tenantId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PermissionsGuard)
  @Permissions('reports.manage')
  @ApiOperation({ summary: 'Delete a report schedule' })
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.schedules.remove(tenantId, id);
  }
}
