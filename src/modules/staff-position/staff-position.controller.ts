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
import { StaffPositionService } from './staff-position.service';
import { CreateStaffPositionDto } from './dto/create-staff-position.dto';
import { UpdateStaffPositionDto } from './dto/update-staff-position.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Staff Positions')
@ApiBearerAuth('JWT')
@Controller('staff-positions')
export class StaffPositionController {
  constructor(private staffPosition: StaffPositionService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('staff.view')
  @ApiOperation({ summary: 'List all staff positions with pagination' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status (true/false)' })
  findAll(
    @CurrentUser('tenantId') _tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveFilter =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.staffPosition.findAll(query, isActiveFilter);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.view')
  @ApiOperation({ summary: 'Get a staff position by ID' })
  findOne(@Param('id') id: string) {
    return this.staffPosition.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Create a new staff position' })
  create(
    @CurrentUser('tenantId') _tenantId: string,
    @Body() dto: CreateStaffPositionDto,
  ) {
    return this.staffPosition.create(dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Update a staff position' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffPositionDto) {
    return this.staffPosition.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Delete a staff position' })
  remove(@Param('id') id: string) {
    return this.staffPosition.remove(id);
  }
}
