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
import { StaffRoleService, STAFF_ROLE_FIELD_MAPPING } from './staff-role.service';
import { CreateStaffRoleDto } from './dto/create-staff-role.dto';
import { UpdateStaffRoleDto } from './dto/update-staff-role.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { ImportExportService } from '../../common/import-export/import-export.service';

@ApiTags('Staff Roles')
@ApiBearerAuth('JWT')
@Controller('staff-roles')
export class StaffRoleController {
  constructor(
    private staffRole: StaffRoleService,
    private importExport: ImportExportService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('staff.view')
  @ApiOperation({ summary: 'List all staff roles with pagination' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status (true/false)' })
  findAll(
    @CurrentUser('tenantId') _tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveFilter =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.staffRole.findAll(query, isActiveFilter);
  }

  /* ─── Export / Import ─────────────────────────────────────────────── */

  @Get('export')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.view')
  @ApiOperation({ summary: 'Export staff roles as XLSX' })
  @ApiQuery({ name: 'isActive', required: false })
  async exportXlsx(
    @Query('isActive') isActive?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const filter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    const rows = await this.staffRole.exportAll(filter);
    const buffer = this.importExport.buildXlsx(rows as unknown as Record<string, unknown>[], STAFF_ROLE_FIELD_MAPPING, 'Staff Roles');
    res?.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="staff-roles-export.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Get('export/template')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Download staff roles import template (XLSX)' })
  exportTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = this.importExport.buildTemplate(STAFF_ROLE_FIELD_MAPPING, 'Staff Roles Template');
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="staff-roles-template.xlsx"' });
    return new StreamableFile(buffer);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.view')
  @ApiOperation({ summary: 'Get a staff role by ID' })
  findOne(@Param('id') id: string) {
    return this.staffRole.findOne(id);
  }

  @Post('import')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Bulk import staff roles from XLSX file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']; if (allowed.includes(file.mimetype) || file.originalname.match(/\.xlsx?$/i)) { cb(null, true); } else { cb(new BadRequestException('Only XLSX files are accepted'), false); } } }))
  async importXlsx(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, STAFF_ROLE_FIELD_MAPPING);
    const result = await this.staffRole.bulkImport(parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Post('import-csv')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Bulk import staff roles from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.match(/\.csv$/i)) { cb(null, true); } else { cb(new BadRequestException('Only CSV files are accepted'), false); } } }))
  async importCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(file.buffer, STAFF_ROLE_FIELD_MAPPING);
    const result = await this.staffRole.bulkImport(parsedRows);
    result.errors.push(...errors); result.total += errors.length;
    return result;
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Create a new staff role' })
  create(
    @CurrentUser('tenantId') _tenantId: string,
    @Body() dto: CreateStaffRoleDto,
  ) {
    return this.staffRole.create(dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Update a staff role' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffRoleDto) {
    return this.staffRole.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('staff.manage')
  @ApiOperation({ summary: 'Delete a staff role' })
  remove(@Param('id') id: string) {
    return this.staffRole.remove(id);
  }
}
