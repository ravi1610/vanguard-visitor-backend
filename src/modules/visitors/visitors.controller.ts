import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VisitorsService } from './visitors.service';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Visitors')
@ApiBearerAuth('JWT')
@Controller('visitors')
@UseGuards(JwtAuthGuard)
export class VisitorsController {
  constructor(private visitors: VisitorsService) {}

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
