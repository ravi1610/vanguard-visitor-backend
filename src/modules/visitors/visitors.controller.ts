import {
  BadRequestException,
  Body,
  Controller,
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
import { VisitorsService, VISITOR_FIELD_MAPPING } from './visitors.service';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { ImportExportService } from '../../common/import-export/import-export.service';

@ApiTags('Visitors')
@ApiBearerAuth('JWT')
@Controller('visitors')
@UseGuards(JwtAuthGuard)
export class VisitorsController {
  constructor(
    private visitors: VisitorsService,
    private importExport: ImportExportService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('visitor.view')
  @ApiOperation({ summary: 'List all visitors with pagination' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
  ) {
    return this.visitors.findAll(tenantId, query);
  }

  /* ─── Export / Import ─────────────────────────────────────────────── */

  @Get('export')
  @UseGuards(PermissionsGuard)
  @Permissions('visitor.view')
  @ApiOperation({ summary: 'Export visitors as XLSX' })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated visitor IDs to export' })
  async exportXlsx(
    @CurrentUser('tenantId') tenantId: string,
    @Query('ids') ids?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const selectedIds = ids
      ? ids.split(',').map((id) => id.trim()).filter(Boolean)
      : undefined;
    const rows = await this.visitors.exportAll(tenantId, selectedIds);
    const buffer = this.importExport.buildXlsx(
      rows as unknown as Record<string, unknown>[],
      VISITOR_FIELD_MAPPING,
      'Visitors',
    );
    res?.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="visitors-export.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Get('export/template')
  @UseGuards(PermissionsGuard)
  @Permissions('visitor.manage')
  @ApiOperation({ summary: 'Download visitor import template (XLSX)' })
  exportTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = this.importExport.buildTemplate(
      VISITOR_FIELD_MAPPING,
      'Visitor Template',
    );
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="visitors-import-template.xlsx"',
    });
    return new StreamableFile(buffer);
  }

  @Post('import')
  @UseGuards(PermissionsGuard)
  @Permissions('visitor.manage')
  @ApiOperation({ summary: 'Bulk import visitors from XLSX file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];
        if (
          allowed.includes(file.mimetype) ||
          file.originalname.match(/\.xlsx?$/i)
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only XLSX files are accepted'), false);
        }
      },
    }),
  )
  async importXlsx(
    @CurrentUser('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(
      file.buffer,
      VISITOR_FIELD_MAPPING,
    );
    const result = await this.visitors.bulkImport(tenantId, parsedRows);
    result.errors.push(...errors);
    result.total += errors.length;
    return result;
  }

  @Post('import-csv')
  @UseGuards(PermissionsGuard)
  @Permissions('visitor.manage')
  @ApiOperation({ summary: 'Bulk import visitors from CSV file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'text/csv' ||
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.match(/\.csv$/i)
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only CSV files are accepted'), false);
        }
      },
    }),
  )
  async importCsv(
    @CurrentUser('tenantId') tenantId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    const { parsedRows, errors } = this.importExport.parseFile(
      file.buffer,
      VISITOR_FIELD_MAPPING,
    );
    const result = await this.visitors.bulkImport(tenantId, parsedRows);
    result.errors.push(...errors);
    result.total += errors.length;
    return result;
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('visitor.view')
  @ApiOperation({ summary: 'Get a visitor by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.visitors.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('visitor.manage')
  @ApiOperation({ summary: 'Register a new visitor' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateVisitorDto,
  ) {
    return this.visitors.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('visitor.manage')
  @ApiOperation({ summary: 'Update a visitor' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVisitorDto,
  ) {
    return this.visitors.update(tenantId, id, dto);
  }
}
