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
import { SpacesService } from './spaces.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { CreateSpaceAssignmentDto } from './dto/create-space-assignment.dto';
import { UpdateSpaceAssignmentDto } from './dto/update-space-assignment.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Spaces')
@ApiBearerAuth('JWT')
@Controller('spaces')
export class SpacesController {
  constructor(private spaces: SpacesService) {}

  @Get('assignments')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.view')
  @ApiOperation({ summary: 'List all space assignments' })
  @ApiQuery({ name: 'spaceId', required: false, description: 'Filter by space ID' })
  @ApiQuery({ name: 'assigneeId', required: false, description: 'Filter by assignee ID' })
  findAllAssignments(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('spaceId') spaceId?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    return this.spaces.findAllAssignments(tenantId, query, spaceId, assigneeId);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.view')
  @ApiOperation({ summary: 'List all spaces with pagination' })
  findAllSpaces(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
  ) {
    return this.spaces.findAllSpaces(tenantId, query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.view')
  @ApiOperation({ summary: 'Get a space by ID' })
  findOneSpace(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.spaces.findOneSpace(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Create a new space' })
  createSpace(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateSpaceDto,
  ) {
    return this.spaces.createSpace(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Update a space' })
  updateSpace(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpaceDto,
  ) {
    return this.spaces.updateSpace(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Delete a space' })
  removeSpace(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.spaces.removeSpace(tenantId, id);
  }
}

@ApiTags('Space Assignments')
@ApiBearerAuth('JWT')
@Controller('space-assignments')
export class SpaceAssignmentsController {
  constructor(private spaces: SpacesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.view')
  @ApiOperation({ summary: 'List all space assignments with pagination' })
  @ApiQuery({ name: 'spaceId', required: false, description: 'Filter by space ID' })
  @ApiQuery({ name: 'assigneeId', required: false, description: 'Filter by assignee ID' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('spaceId') spaceId?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    return this.spaces.findAllAssignments(tenantId, query, spaceId, assigneeId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.view')
  @ApiOperation({ summary: 'Get a space assignment by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.spaces.findOneAssignment(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Create a new space assignment' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateSpaceAssignmentDto,
  ) {
    return this.spaces.createAssignment(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Update a space assignment' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSpaceAssignmentDto,
  ) {
    return this.spaces.updateAssignment(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Delete a space assignment' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.spaces.removeAssignment(tenantId, id);
  }
}
