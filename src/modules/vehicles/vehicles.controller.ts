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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { VehiclesService, VEHICLE_FIELD_MAPPING } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { ImportExportService } from '../../common/import-export/import-export.service';

@ApiTags('Vehicles')
@ApiBearerAuth('JWT')
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private vehicles: VehiclesService,
    private importExport: ImportExportService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('vehicles.view')
  @ApiOperation({ summary: 'List all vehicles with pagination' })
  @ApiQuery({ name: 'ownerId', required: false, description: 'Filter by owner ID' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.vehicles.findAll(tenantId, query, ownerId);
  }

  /* ─── Export / Import ─────────────────────────────────────────────── */

  @Get('export')
  @UseGuards(PermissionsGuard)
  @Permissions('vehicles.view')
  @ApiOperation({ summary: 'Export vehicles as XLSX' })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated IDs to export' })
  async exportXlsx(
    @CurrentUser('tenantId') tenantId: string,
    @Query('ids') ids?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const selectedIds = ids ? ids.split(',').map((id) => id.trim()).filter(Boolean) : undefined;
    const rows = await this.vehicles.exportAll(tenantId, selectedIds);
    const buffer = this.importExport.buildXlsx(rows as unknown as Record<string, unknown>[], VEHICLE_FIELD_MAPPING, 'Vehicles');
    res?.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="vehicles-export.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Get('export/template')
  @UseGuards(PermissionsGuard)
  @Permissions('vehicles.manage')
  @ApiOperation({ summary: 'Download vehicles import template (XLSX)' })
  exportTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = this.importExport.buildTemplate(VEHICLE_FIELD_MAPPING, 'Vehicles Template');
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="vehicles-import-template.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Post('import')
  @UseGuards(PermissionsGuard)
  @Permissions('vehicles.manage')
  @ApiOperation({ summary: 'Bulk import vehicles from XLSX file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']; if (allowed.includes(file.mimetype) || file.originalname.match(/\.xlsx?$/i)) { cb(null, true); } else { cb(new BadRequestException('Only XLSX files are accepted'), false); } } }))
  async importXlsx(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, VEHICLE_FIELD_MAPPING);
    const result = await this.vehicles.bulkImport(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Post('import-csv')
  @UseGuards(PermissionsGuard)
  @Permissions('vehicles.manage')
  @ApiOperation({ summary: 'Bulk import vehicles from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.match(/\.csv$/i)) { cb(null, true); } else { cb(new BadRequestException('Only CSV files are accepted'), false); } } }))
  async importCsv(@CurrentUser('tenantId') tenantId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, VEHICLE_FIELD_MAPPING);
    const result = await this.vehicles.bulkImport(tenantId, parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('vehicles.view')
  @ApiOperation({ summary: 'Get a vehicle by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.vehicles.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('vehicles.manage')
  @ApiOperation({ summary: 'Register a new vehicle' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateVehicleDto,
  ) {
    return this.vehicles.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('vehicles.manage')
  @ApiOperation({ summary: 'Update a vehicle' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehicles.update(tenantId, id, dto);
  }

  @Post(':id/photo')
  @UseGuards(PermissionsGuard)
  @Permissions('vehicles.manage')
  @ApiOperation({ summary: 'Upload vehicle photo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/vehicles',
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed'), false);
        }
      },
    }),
  )
  async uploadPhoto(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No image file provided');
    const photoUrl = `/uploads/vehicles/${file.filename}`;
    return this.vehicles.updatePhoto(tenantId, id, photoUrl);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('vehicles.manage')
  @ApiOperation({ summary: 'Delete a vehicle' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.vehicles.remove(tenantId, id);
  }
}
