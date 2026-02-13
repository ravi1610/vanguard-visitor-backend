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
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Maintenance')
@ApiBearerAuth('JWT')
@Controller('maintenance')
export class MaintenanceController {
  constructor(private maintenance: MaintenanceService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('maintenance.view')
  @ApiOperation({ summary: 'List all work orders with pagination' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by work order status' })
  @ApiQuery({ name: 'assignedToUserId', required: false, description: 'Filter by assigned user ID' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
  ) {
    return this.maintenance.findAll(tenantId, query, status, assignedToUserId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('maintenance.view')
  @ApiOperation({ summary: 'Get a work order by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.maintenance.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('maintenance.manage')
  @ApiOperation({ summary: 'Create a new work order' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateMaintenanceDto,
  ) {
    return this.maintenance.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('maintenance.manage')
  @ApiOperation({ summary: 'Update a work order' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceDto,
  ) {
    return this.maintenance.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('maintenance.manage')
  @ApiOperation({ summary: 'Delete a work order' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.maintenance.remove(tenantId, id);
  }
}
