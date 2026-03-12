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
import { SpacesService, SPACE_FIELD_MAPPING, SPACE_ASSIGNMENT_FIELD_MAPPING } from './spaces.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { CreateSpaceAssignmentDto } from './dto/create-space-assignment.dto';
import { UpdateSpaceAssignmentDto } from './dto/update-space-assignment.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { ImportExportService } from '../../common/import-export/import-export.service';

@ApiTags('Spaces')
@ApiBearerAuth('JWT')
@Controller('spaces')
export class SpacesController {
  constructor(
    private spaces: SpacesService,
    private importExport: ImportExportService,
  ) {}

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

  /* ─── Export / Import ─────────────────────────────────────────────── */

  @Get('export')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.view')
  @ApiOperation({ summary: 'Export spaces as XLSX' })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated IDs to export' })
  async exportXlsx(
    @CurrentUser('tenantId') tenantId: string,
    @Query('ids') ids?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const selectedIds = ids ? ids.split(',').map((id) => id.trim()).filter(Boolean) : undefined;
    const rows = await this.spaces.exportAllSpaces(tenantId, selectedIds);
    const buffer = this.importExport.buildXlsx(rows as unknown as Record<string, unknown>[], SPACE_FIELD_MAPPING, 'Spaces');
    res?.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="spaces-export.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Get('export/template')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Download spaces import template (XLSX)' })
  exportTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = this.importExport.buildTemplate(SPACE_FIELD_MAPPING, 'Spaces Template');
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="spaces-import-template.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Post('import')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Bulk import spaces from XLSX file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']; if (allowed.includes(file.mimetype) || file.originalname.match(/\.xlsx?$/i)) { cb(null, true); } else { cb(new BadRequestException('Only XLSX files are accepted'), false); } } }))
  async importXlsx(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, SPACE_FIELD_MAPPING);
    const result = await this.spaces.bulkImportSpaces(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Post('import-csv')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Bulk import spaces from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.match(/\.csv$/i)) { cb(null, true); } else { cb(new BadRequestException('Only CSV files are accepted'), false); } } }))
  async importCsv(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, SPACE_FIELD_MAPPING);
    const result = await this.spaces.bulkImportSpaces(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
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
  constructor(
    private spaces: SpacesService,
    private importExport: ImportExportService,
  ) {}

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

  /* ─── Export / Import ─────────────────────────────────────────────── */

  @Get('export')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.view')
  @ApiOperation({ summary: 'Export space assignments as XLSX' })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated IDs to export' })
  async exportXlsx(
    @CurrentUser('tenantId') tenantId: string,
    @Query('ids') ids?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const selectedIds = ids ? ids.split(',').map((id) => id.trim()).filter(Boolean) : undefined;
    const rows = await this.spaces.exportAllAssignments(tenantId, selectedIds);
    const buffer = this.importExport.buildXlsx(rows as unknown as Record<string, unknown>[], SPACE_ASSIGNMENT_FIELD_MAPPING, 'Space Assignments');
    res?.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="space-assignments-export.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Get('export/template')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Download space assignments import template (XLSX)' })
  exportTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = this.importExport.buildTemplate(SPACE_ASSIGNMENT_FIELD_MAPPING, 'Assignments Template');
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="space-assignments-import-template.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Post('import')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Bulk import space assignments from XLSX file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']; if (allowed.includes(file.mimetype) || file.originalname.match(/\.xlsx?$/i)) { cb(null, true); } else { cb(new BadRequestException('Only XLSX files are accepted'), false); } } }))
  async importXlsx(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, SPACE_ASSIGNMENT_FIELD_MAPPING);
    const result = await this.spaces.bulkImportAssignments(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Post('import-csv')
  @UseGuards(PermissionsGuard)
  @Permissions('spaces.manage')
  @ApiOperation({ summary: 'Bulk import space assignments from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.match(/\.csv$/i)) { cb(null, true); } else { cb(new BadRequestException('Only CSV files are accepted'), false); } } }))
  async importCsv(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, SPACE_ASSIGNMENT_FIELD_MAPPING);
    const result = await this.spaces.bulkImportAssignments(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
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
