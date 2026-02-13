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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Vendors')
@ApiBearerAuth('JWT')
@Controller('vendors')
export class VendorsController {
  constructor(private vendors: VendorsService) {}

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
