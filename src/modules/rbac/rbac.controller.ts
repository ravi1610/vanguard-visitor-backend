import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';

class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}

class UpdateUserOverridesDto {
  @IsArray()
  @IsString({ each: true })
  grants!: string[];

  @IsArray()
  @IsString({ each: true })
  denies!: string[];
}

@ApiTags('Roles')
@ApiBearerAuth('JWT')
@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(private rbac: RbacService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'List all roles for current tenant' })
  getRoles(@CurrentUser('tenantId') tenantId: string) {
    return this.rbac.getRolesForTenant(tenantId);
  }

  @Get('permissions-catalog')
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'List all available permission keys' })
  getPermissionCatalog() {
    return this.rbac.getPermissionCatalog();
  }

  @Get('permission-matrix')
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Get tenant roles with assigned permission keys' })
  getPermissionMatrix(@CurrentUser('tenantId') tenantId: string) {
    return this.rbac.getPermissionMatrix(tenantId);
  }

  @Patch(':roleId/permissions')
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Replace all permissions for a role' })
  setRolePermissions(
    @CurrentUser('tenantId') tenantId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rbac.setRolePermissions(tenantId, roleId, dto.permissionKeys ?? []);
  }

  @Get('users/:userId/permissions')
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Get effective permissions and overrides for a user' })
  getUserPermissions(
    @CurrentUser('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.rbac.getUserPermissionProfile(tenantId, userId);
  }

  @Patch('users/:userId/permissions')
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Replace user-specific permission overrides' })
  setUserPermissionOverrides(
    @CurrentUser('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserOverridesDto,
  ) {
    return this.rbac.setUserPermissionOverrides(
      tenantId,
      userId,
      dto.grants ?? [],
      dto.denies ?? [],
    );
  }
}
