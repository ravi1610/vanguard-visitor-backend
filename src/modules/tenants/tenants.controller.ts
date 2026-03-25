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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Tenants')
@ApiBearerAuth('JWT')
@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private tenants: TenantsService) {}

  @Get('me')
  @UseGuards(PermissionsGuard)
  @Permissions('tenant.read')
  @ApiOperation({ summary: 'Get current tenant details' })
  getMyTenant(@CurrentUser('tenantId') tenantId: string) {
    return this.tenants.getMyTenant(tenantId);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('tenant.read')
  @ApiOperation({ summary: 'List all tenants' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: PagedQueryDto,
    @Query('isActive') isActive?: string,
  ) {
    return this.tenants.findMany(
      user.tenantId,
      user.isSuperAdmin ?? false,
      query,
      isActive,
    );
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('tenant.create')
  @ApiOperation({ summary: 'Create a new tenant' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTenantDto,
  ) {
    return this.tenants.create(dto, user.sub);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('tenant.update')
  @ApiOperation({ summary: 'Update a tenant' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenants.update(id, user.tenantId, dto, user.isSuperAdmin ?? false);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('tenant.delete')
  @ApiOperation({ summary: 'Delete a tenant' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tenants.remove(id, user.isSuperAdmin ?? false);
  }
}
