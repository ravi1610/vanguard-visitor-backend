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
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Documents')
@ApiBearerAuth('JWT')
@Controller('documents')
export class DocumentsController {
  constructor(private documents: DocumentsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('documents.view')
  @ApiOperation({ summary: 'List all documents with pagination' })
  @ApiQuery({ name: 'uploadedByUserId', required: false, description: 'Filter by uploader user ID' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('uploadedByUserId') uploadedByUserId?: string,
  ) {
    return this.documents.findAll(tenantId, query, uploadedByUserId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('documents.view')
  @ApiOperation({ summary: 'Get a document by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.documents.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('documents.manage')
  @ApiOperation({ summary: 'Upload a new document' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDocumentDto) {
    return this.documents.create(user.tenantId, dto, user.sub);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('documents.manage')
  @ApiOperation({ summary: 'Update a document' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documents.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('documents.manage')
  @ApiOperation({ summary: 'Delete a document' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.documents.remove(tenantId, id);
  }
}
