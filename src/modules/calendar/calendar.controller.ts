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
import { CalendarService, CALENDAR_FIELD_MAPPING } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { ImportExportService } from '../../common/import-export/import-export.service';

@ApiTags('Calendar')
@ApiBearerAuth('JWT')
@Controller('calendar')
export class CalendarController {
  constructor(
    private calendar: CalendarService,
    private importExport: ImportExportService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.view')
  @ApiOperation({ summary: 'List all calendar events with pagination' })
  @ApiQuery({ name: 'from', required: false, description: 'Start date filter (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date filter (ISO 8601)' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calendar.findAll(tenantId, query, from, to);
  }

  /* ─── Export / Import ─────────────────────────────────────────────── */

  @Get('export')
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.export')
  @ApiOperation({ summary: 'Export calendar events as XLSX' })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated IDs to export' })
  async exportXlsx(
    @CurrentUser('tenantId') tenantId: string,
    @Query('ids') ids?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const selectedIds = ids ? ids.split(',').map((id) => id.trim()).filter(Boolean) : undefined;
    const rows = await this.calendar.exportAll(tenantId, selectedIds);
    const buffer = this.importExport.buildXlsx(rows as unknown as Record<string, unknown>[], CALENDAR_FIELD_MAPPING, 'Calendar');
    res?.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="calendar-export.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Get('export/template')
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.import')
  @ApiOperation({ summary: 'Download calendar import template (XLSX)' })
  exportTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = this.importExport.buildTemplate(CALENDAR_FIELD_MAPPING, 'Calendar Template');
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="calendar-import-template.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Post('import')
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.import')
  @ApiOperation({ summary: 'Bulk import events from XLSX file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']; if (allowed.includes(file.mimetype) || file.originalname.match(/\.xlsx?$/i)) { cb(null, true); } else { cb(new BadRequestException('Only XLSX files are accepted'), false); } } }))
  async importXlsx(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, CALENDAR_FIELD_MAPPING);
    const result = await this.calendar.bulkImport(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Post('import-csv')
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.import')
  @ApiOperation({ summary: 'Bulk import events from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.match(/\.csv$/i)) { cb(null, true); } else { cb(new BadRequestException('Only CSV files are accepted'), false); } } }))
  async importCsv(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, CALENDAR_FIELD_MAPPING);
    const result = await this.calendar.bulkImport(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.view')
  @ApiOperation({ summary: 'Get a calendar event by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.calendar.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.create')
  @ApiOperation({ summary: 'Create a new calendar event' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendar.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.update')
  @ApiOperation({ summary: 'Update a calendar event' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendar.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('calendar.delete')
  @ApiOperation({ summary: 'Delete a calendar event' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.calendar.remove(tenantId, id);
  }
}
