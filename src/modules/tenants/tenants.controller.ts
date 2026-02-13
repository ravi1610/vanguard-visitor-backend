import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('Tenants')
@ApiBearerAuth('JWT')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current tenant details' })
  getMyTenant(@CurrentUser('tenantId') tenantId: string) {
    return this.tenants.getMyTenant(tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  findAll(@CurrentUser('tenantId') tenantId: string) {
    return this.tenants.findMany(tenantId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('tenant.manage')
  @ApiOperation({ summary: 'Create a new tenant' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTenantDto,
  ) {
    return this.tenants.create(dto, user.sub);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('tenant.manage')
  @ApiOperation({ summary: 'Update a tenant' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenants.update(id, user.tenantId, dto);
  }
}
