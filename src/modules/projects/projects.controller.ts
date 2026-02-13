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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Projects')
@ApiBearerAuth('JWT')
@Controller('projects')
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('projects.view')
  @ApiOperation({ summary: 'List all projects with pagination' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by project status' })
  findAllProjects(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
  ) {
    return this.projects.findAllProjects(tenantId, query, status);
  }

  @Get(':projectId')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.view')
  @ApiOperation({ summary: 'Get a project by ID' })
  findOneProject(
    @CurrentUser('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.findOneProject(tenantId, projectId);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('projects.manage')
  @ApiOperation({ summary: 'Create a new project' })
  createProject(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.createProject(tenantId, dto);
  }

  @Patch(':projectId')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.manage')
  @ApiOperation({ summary: 'Update a project' })
  updateProject(
    @CurrentUser('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.updateProject(tenantId, projectId, dto);
  }

  @Delete(':projectId')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.manage')
  @ApiOperation({ summary: 'Delete a project' })
  removeProject(
    @CurrentUser('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.removeProject(tenantId, projectId);
  }

  @Get(':projectId/tasks')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.view')
  @ApiOperation({ summary: 'List all tasks for a project' })
  findAllTasks(
    @CurrentUser('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.findAllTasks(tenantId, projectId);
  }

  @Get(':projectId/tasks/:taskId')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.view')
  @ApiOperation({ summary: 'Get a task by ID' })
  findOneTask(
    @CurrentUser('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.projects.findOneTask(tenantId, projectId, taskId);
  }

  @Post(':projectId/tasks')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.manage')
  @ApiOperation({ summary: 'Create a new task in a project' })
  createTask(
    @CurrentUser('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.projects.createTask(tenantId, projectId, dto);
  }

  @Patch(':projectId/tasks/:taskId')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.manage')
  @ApiOperation({ summary: 'Update a task' })
  updateTask(
    @CurrentUser('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.projects.updateTask(tenantId, projectId, taskId, dto);
  }

  @Delete(':projectId/tasks/:taskId')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.manage')
  @ApiOperation({ summary: 'Delete a task' })
  removeTask(
    @CurrentUser('tenantId') tenantId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.projects.removeTask(tenantId, projectId, taskId);
  }
}
