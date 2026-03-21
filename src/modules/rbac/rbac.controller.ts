import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsArray, IsOptional, IsNotEmpty, IsString } from 'class-validator';
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

class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsOptional()
  description?: string | null;
}

class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  key?: string;

  @IsString()
  @IsOptional()
  description?: string | null;
}

@ApiTags('Roles')
@ApiBearerAuth('JWT')
@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(private rbac: RbacService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('permissions.view', 'permissions.manage')
  @ApiOperation({ summary: 'List all roles for current tenant' })
  getRoles(@CurrentUser('tenantId') tenantId: string) {
    return this.rbac.getRolesForTenant(tenantId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('permissions.manage')
  @ApiOperation({ summary: 'Create a custom role' })
  createRole(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rbac.createRole(tenantId, dto);
  }

  @Patch(':roleId')
  @UseGuards(PermissionsGuard)
  @Permissions('permissions.manage')
  @ApiOperation({ summary: 'Update role metadata' })
  updateRole(
    @CurrentUser('tenantId') tenantId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbac.updateRole(tenantId, roleId, dto);
  }

  @Delete(':roleId')
  @UseGuards(PermissionsGuard)
  @Permissions('permissions.manage')
  @ApiOperation({ summary: 'Delete a role' })
  deleteRole(
    @CurrentUser('tenantId') tenantId: string,
    @Param('roleId') roleId: string,
  ) {
    return this.rbac.deleteRole(tenantId, roleId);
  }

  @Get('permissions-catalog')
  @UseGuards(PermissionsGuard)
  @Permissions('permissions.view', 'permissions.manage')
  @ApiOperation({ summary: 'List all available permission keys' })
  getPermissionCatalog() {
    return this.rbac.getPermissionCatalog();
  }

  @Get('permission-matrix')
  @UseGuards(PermissionsGuard)
  @Permissions('permissions.view', 'permissions.manage')
  @ApiOperation({ summary: 'Get tenant roles with assigned permission keys' })
  getPermissionMatrix(@CurrentUser('tenantId') tenantId: string) {
    return this.rbac.getPermissionMatrix(tenantId);
  }

  @Patch(':roleId/permissions')
  @UseGuards(PermissionsGuard)
  @Permissions('permissions.manage')
  @ApiOperation({ summary: 'Replace all permissions for a role' })
  setRolePermissions(
    @CurrentUser('tenantId') tenantId: string,
    @Param('roleId') roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rbac.setRolePermissions(
      tenantId,
      roleId,
      dto.permissionKeys ?? [],
    );
  }

  @Get('users/:userId/permissions')
  @UseGuards(PermissionsGuard)
  @Permissions('permissions.view', 'permissions.manage')
  @ApiOperation({
    summary: 'Get effective permissions and overrides for a user',
  })
  getUserPermissions(
    @CurrentUser('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    return this.rbac.getUserPermissionProfile(tenantId, userId);
  }

  @Patch('users/:userId/permissions')
  @UseGuards(PermissionsGuard)
  @Permissions('permissions.manage')
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
