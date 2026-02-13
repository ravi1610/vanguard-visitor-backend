import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Calendar')
@ApiBearerAuth('JWT')
@Controller('calendar')
export class CalendarController {
  constructor(private calendar: CalendarService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.view')
  @ApiOperation({ summary: 'List all calendar events with pagination' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter (ISO 8601)' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendar.findAll(tenantId, query, from, to);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.view')
  @ApiOperation({ summary: 'Get a calendar event by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.calendar.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.manage')
  @ApiOperation({ summary: 'Create a new calendar event' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendar.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.manage')
  @ApiOperation({ summary: 'Update a calendar event' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendar.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.manage')
  @ApiOperation({ summary: 'Delete a calendar event' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.calendar.remove(tenantId, id);
  }
}
