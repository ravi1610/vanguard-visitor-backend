import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { DocumentCategoryService } from './document-category.service';
import { CreateDocumentCategoryDto } from './dto/create-document-category.dto';
import { UpdateDocumentCategoryDto } from './dto/update-document-category.dto';

@ApiTags('Document Categories')
@ApiBearerAuth('JWT')
@Controller('document-categories')
export class DocumentCategoryController {
  constructor(private categories: DocumentCategoryService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('documents.view')
  @ApiOperation({ summary: 'List all document categories with pagination' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status (true/false)' })
  findAll(@Query() query: PagedQueryDto, @Query('isActive') isActive?: string) {
    const isActiveFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.categories.findAll(query, isActiveFilter);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('documents.view')
  @ApiOperation({ summary: 'Get a document category by ID' })
  findOne(@Param('id') id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('documents.manage')
  @ApiOperation({ summary: 'Create a document category' })
  create(@Body() dto: CreateDocumentCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('documents.manage')
  @ApiOperation({ summary: 'Update a document category' })
  update(@Param('id') id: string, @Body() dto: UpdateDocumentCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('documents.manage')
  @ApiOperation({ summary: 'Delete a document category' })
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
