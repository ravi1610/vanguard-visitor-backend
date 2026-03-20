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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { VendorsService, VENDOR_FIELD_MAPPING } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { ImportExportService } from '../../common/import-export/import-export.service';

@ApiTags('Vendors')
@ApiBearerAuth('JWT')
@Controller('vendors')
export class VendorsController {
  constructor(
    private vendors: VendorsService,
    private importExport: ImportExportService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('vendors.view')
  @ApiOperation({ summary: 'List all vendors with pagination' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
  ) {
    return this.vendors.findAll(tenantId, query);
  }

  /* ─── Export / Import ─────────────────────────────────────────────── */

  @Get('export')
  @UseGuards(PermissionsGuard)
  @Permissions('vendors.view')
  @ApiOperation({ summary: 'Export vendors as XLSX' })
  async exportXlsx(
    @CurrentUser('tenantId') tenantId: string,
    @Query('ids') ids?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const selectedIds = ids ? ids.split(',').map((id) => id.trim()).filter(Boolean) : undefined;
    const rows = await this.vendors.exportAll(tenantId, selectedIds);
    const buffer = this.importExport.buildXlsx(rows as unknown as Record<string, unknown>[], VENDOR_FIELD_MAPPING, 'Vendors');
    res?.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="vendors-export.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Get('export/template')
  @UseGuards(PermissionsGuard)
  @Permissions('vendors.manage')
  @ApiOperation({ summary: 'Download vendors import template (XLSX)' })
  exportTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = this.importExport.buildTemplate(VENDOR_FIELD_MAPPING, 'Vendors Template');
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="vendors-import-template.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Post('import')
  @UseGuards(PermissionsGuard)
  @Permissions('vendors.manage')
  @ApiOperation({ summary: 'Bulk import vendors from XLSX file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']; if (allowed.includes(file.mimetype) || file.originalname.match(/\.xlsx?$/i)) { cb(null, true); } else { cb(new BadRequestException('Only XLSX files are accepted'), false); } } }))
  async importXlsx(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, VENDOR_FIELD_MAPPING);
    const result = await this.vendors.bulkImport(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Post('import-csv')
  @UseGuards(PermissionsGuard)
  @Permissions('vendors.manage')
  @ApiOperation({ summary: 'Bulk import vendors from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.match(/\.csv$/i)) { cb(null, true); } else { cb(new BadRequestException('Only CSV files are accepted'), false); } } }))
  async importCsv(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, VENDOR_FIELD_MAPPING);
    const result = await this.vendors.bulkImport(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('vendors.view')
  @ApiOperation({ summary: 'Get a vendor by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.vendors.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('vendors.manage')
  @ApiOperation({ summary: 'Create a new vendor' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateVendorDto,
  ) {
    return this.vendors.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('vendors.manage')
  @ApiOperation({ summary: 'Update a vendor' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendors.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('vendors.manage')
  @ApiOperation({ summary: 'Delete a vendor' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.vendors.remove(tenantId, id);
  }
}
