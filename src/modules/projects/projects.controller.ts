import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ProjectsService, PROJECT_FIELD_MAPPING } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { ImportExportService } from '../../common/import-export/import-export.service';

@ApiTags('Projects')
@ApiBearerAuth('JWT')
@Controller('projects')
export class ProjectsController {
  constructor(
    private projects: ProjectsService,
    private importExport: ImportExportService,
  ) {}

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

  /* ─── Export / Import ─────────────────────────────────────────────── */

  @Get('export')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.view')
  @ApiOperation({ summary: 'Export projects as XLSX' })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated IDs to export' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  async exportXlsx(
    @CurrentUser('tenantId') tenantId: string,
    @Query('ids') ids?: string,
    @Query('status') status?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const selectedIds = ids ? ids.split(',').map((id) => id.trim()).filter(Boolean) : undefined;
    const rows = await this.projects.exportAllProjects(tenantId, selectedIds, status);
    const buffer = this.importExport.buildXlsx(rows as unknown as Record<string, unknown>[], PROJECT_FIELD_MAPPING, 'Projects');
    res?.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="projects-export.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Get('export/template')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.manage')
  @ApiOperation({ summary: 'Download projects import template (XLSX)' })
  exportTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = this.importExport.buildTemplate(PROJECT_FIELD_MAPPING, 'Projects Template');
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="projects-import-template.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Post('import')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.manage')
  @ApiOperation({ summary: 'Bulk import projects from XLSX file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']; if (allowed.includes(file.mimetype) || file.originalname.match(/\.xlsx?$/i)) { cb(null, true); } else { cb(new BadRequestException('Only XLSX files are accepted'), false); } } }))
  async importXlsx(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, PROJECT_FIELD_MAPPING);
    const result = await this.projects.bulkImportProjects(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Post('import-csv')
  @UseGuards(PermissionsGuard)
  @Permissions('projects.manage')
  @ApiOperation({ summary: 'Bulk import projects from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.match(/\.csv$/i)) { cb(null, true); } else { cb(new BadRequestException('Only CSV files are accepted'), false); } } }))
  async importCsv(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, PROJECT_FIELD_MAPPING);
    const result = await this.projects.bulkImportProjects(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
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
