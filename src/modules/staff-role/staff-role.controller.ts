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
import { StaffRoleService } from './staff-role.service';
import { CreateStaffRoleDto } from './dto/create-staff-role.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Staff Roles')
@ApiBearerAuth('JWT')
@Controller('staff-roles')
export class StaffRoleController {
  constructor(private staffRole: StaffRoleService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('staff.view')
  @ApiOperation({ summary: 'List all staff roles with pagination' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status (true/false)' })
  findAll(
    @CurrentUser('tenantId') _tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveFilter =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.staffRole.findAll(query, isActiveFilter);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.view')
  @ApiOperation({ summary: 'Get a staff role by ID' })
  findOne(@Param('id') id: string) {
    return this.staffRole.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Create a new staff role' })
  create(
    @CurrentUser('tenantId') _tenantId: string,
    @Body() dto: CreateStaffRoleDto,
  ) {
    return this.staffRole.create(dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Update a staff role' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffRoleDto) {
    return this.staffRole.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Delete a staff role' })
  remove(@Param('id') id: string) {
    return this.staffRole.remove(id);
  }
}
