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
import { ViolationsService } from './violations.service';
import { CreateViolationDto } from './dto/create-violation.dto';
import { UpdateViolationDto } from './dto/update-violation.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Violations')
@ApiBearerAuth('JWT')
@Controller('violations')
export class ViolationsController {
  constructor(private violations: ViolationsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('violations.view')
  @ApiOperation({ summary: 'List violations with pagination' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user/resident ID' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by violation status' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
  ) {
    return this.violations.findAll(tenantId, query, userId, status);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('violations.view')
  @ApiOperation({ summary: 'Get a violation by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.violations.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('violations.manage')
  @ApiOperation({ summary: 'Create a new violation' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateViolationDto,
  ) {
    return this.violations.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('violations.manage')
  @ApiOperation({ summary: 'Update a violation' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateViolationDto,
  ) {
    return this.violations.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('violations.manage')
  @ApiOperation({ summary: 'Delete a violation' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.violations.remove(tenantId, id);
  }
}
