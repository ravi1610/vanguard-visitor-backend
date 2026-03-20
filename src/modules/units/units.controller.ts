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
import { UnitsService, UNIT_FIELD_MAPPING } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { ImportExportService } from '../../common/import-export/import-export.service';

@ApiTags('Units')
@ApiBearerAuth('JWT')
@Controller('units')
export class UnitsController {
  constructor(
    private units: UnitsService,
    private importExport: ImportExportService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('units.view')
  @ApiOperation({ summary: 'List all units with pagination' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by unit status' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
  ) {
    return this.units.findAll(tenantId, query, status);
  }

  /* ─── Export / Import ─────────────────────────────────────────────── */

  @Get('export')
  @UseGuards(PermissionsGuard)
  @Permissions('units.view')
  @ApiOperation({ summary: 'Export units as XLSX' })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated IDs to export' })
  async exportXlsx(
    @CurrentUser('tenantId') tenantId: string,
    @Query('ids') ids?: string,
    @Query('status') status?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const selectedIds = ids ? ids.split(',').map((id) => id.trim()).filter(Boolean) : undefined;
    const rows = await this.units.exportAll(tenantId, selectedIds, status);
    const buffer = this.importExport.buildXlsx(rows as unknown as Record<string, unknown>[], UNIT_FIELD_MAPPING, 'Units');
    res?.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="units-export.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Get('export/template')
  @UseGuards(PermissionsGuard)
  @Permissions('units.manage')
  @ApiOperation({ summary: 'Download units import template (XLSX)' })
  exportTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = this.importExport.buildTemplate(UNIT_FIELD_MAPPING, 'Units Template');
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="units-import-template.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Post('import')
  @UseGuards(PermissionsGuard)
  @Permissions('units.manage')
  @ApiOperation({ summary: 'Bulk import units from XLSX file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']; if (allowed.includes(file.mimetype) || file.originalname.match(/\.xlsx?$/i)) { cb(null, true); } else { cb(new BadRequestException('Only XLSX files are accepted'), false); } } }))
  async importXlsx(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, UNIT_FIELD_MAPPING);
    const result = await this.units.bulkImport(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Post('import-csv')
  @UseGuards(PermissionsGuard)
  @Permissions('units.manage')
  @ApiOperation({ summary: 'Bulk import units from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.match(/\.csv$/i)) { cb(null, true); } else { cb(new BadRequestException('Only CSV files are accepted'), false); } } }))
  async importCsv(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, UNIT_FIELD_MAPPING);
    const result = await this.units.bulkImport(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('units.view')
  @ApiOperation({ summary: 'Get a unit by ID with residents and related data' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.units.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('units.manage')
  @ApiOperation({ summary: 'Create a new unit' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateUnitDto,
  ) {
    return this.units.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('units.manage')
  @ApiOperation({ summary: 'Update a unit' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
  ) {
    return this.units.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('units.manage')
  @ApiOperation({ summary: 'Delete a unit' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.units.remove(tenantId, id);
  }
}
