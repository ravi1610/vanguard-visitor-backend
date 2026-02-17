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
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Units')
@ApiBearerAuth('JWT')
@Controller('units')
export class UnitsController {
  constructor(private units: UnitsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('units.view')
  @ApiOperation({ summary: 'List all units with pagination' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by unit status' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
  ) {
    return this.units.findAll(tenantId, query, status);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('units.view')
  @ApiOperation({ summary: 'Get a unit by ID with residents and related data' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.units.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('units.manage')
  @ApiOperation({ summary: 'Create a new unit' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateUnitDto,
  ) {
    return this.units.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('units.manage')
  @ApiOperation({ summary: 'Update a unit' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.units.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('units.manage')
  @ApiOperation({ summary: 'Delete a unit' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.units.remove(tenantId, id);
  }
}
