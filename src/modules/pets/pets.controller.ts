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
import { PetsService } from './pets.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Pets')
@ApiBearerAuth('JWT')
@Controller('pets')
export class PetsController {
  constructor(private pets: PetsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('pets.view')
  @ApiOperation({ summary: 'List pets with pagination' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user/resident ID' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('userId') userId?: string,
  ) {
    return this.pets.findAll(tenantId, query, userId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('pets.view')
  @ApiOperation({ summary: 'Get a pet by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.pets.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('pets.manage')
  @ApiOperation({ summary: 'Register a new pet' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreatePetDto,
  ) {
    return this.pets.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('pets.manage')
  @ApiOperation({ summary: 'Update a pet' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePetDto,
  ) {
    return this.pets.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('pets.manage')
  @ApiOperation({ summary: 'Delete a pet' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.pets.remove(tenantId, id);
  }
}
