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
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Departments')
@ApiBearerAuth('JWT')
@Controller('departments')
export class DepartmentController {
  constructor(private department: DepartmentService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('staff.view')
  @ApiOperation({ summary: 'List all departments with pagination' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status (true/false)' })
  findAll(
    @CurrentUser('tenantId') _tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveFilter =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.department.findAll(query, isActiveFilter);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.view')
  @ApiOperation({ summary: 'Get a department by ID' })
  findOne(@Param('id') id: string) {
    return this.department.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Create a new department' })
  create(
    @CurrentUser('tenantId') _tenantId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.department.create(dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Update a department' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.department.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Delete a department' })
  remove(@Param('id') id: string) {
    return this.department.remove(id);
  }
}
