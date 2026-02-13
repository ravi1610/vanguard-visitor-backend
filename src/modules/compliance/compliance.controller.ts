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
import { ComplianceService } from './compliance.service';
import { CreateComplianceItemDto } from './dto/create-compliance.dto';
import { UpdateComplianceItemDto } from './dto/update-compliance.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Compliance')
@ApiBearerAuth('JWT')
@Controller('compliance')
export class ComplianceController {
  constructor(private compliance: ComplianceService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('compliance.view')
  @ApiOperation({ summary: 'List all compliance items with pagination' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by compliance status' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
  ) {
    return this.compliance.findAll(tenantId, query, status);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('compliance.view')
  @ApiOperation({ summary: 'Get a compliance item by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.compliance.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('compliance.manage')
  @ApiOperation({ summary: 'Create a new compliance item' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateComplianceItemDto,
  ) {
    return this.compliance.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('compliance.manage')
  @ApiOperation({ summary: 'Update a compliance item' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateComplianceItemDto,
  ) {
    return this.compliance.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('compliance.manage')
  @ApiOperation({ summary: 'Delete a compliance item' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.compliance.remove(tenantId, id);
  }
}
