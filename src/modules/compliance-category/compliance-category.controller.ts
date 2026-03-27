import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';
import { ComplianceCategoryService } from './compliance-category.service';
import { CreateComplianceCategoryDto } from './dto/create-compliance-category.dto';
import { UpdateComplianceCategoryDto } from './dto/update-compliance-category.dto';

@ApiTags('Compliance Categories')
@ApiBearerAuth('JWT')
@Controller('compliance-categories')
export class ComplianceCategoryController {
  constructor(private categories: ComplianceCategoryService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('compliance.view')
  @ApiOperation({ summary: 'List all compliance categories with pagination' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status (true/false)' })
  findAll(@Query() query: PagedQueryDto, @Query('isActive') isActive?: string) {
    const isActiveFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.categories.findAll(query, isActiveFilter);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('compliance.view')
  @ApiOperation({ summary: 'Get a compliance category by ID' })
  findOne(@Param('id') id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('compliance.manage')
  @ApiOperation({ summary: 'Create a compliance category' })
  create(@Body() dto: CreateComplianceCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('compliance.manage')
  @ApiOperation({ summary: 'Update a compliance category' })
  update(@Param('id') id: string, @Body() dto: UpdateComplianceCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('compliance.manage')
  @ApiOperation({ summary: 'Delete a compliance category' })
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
