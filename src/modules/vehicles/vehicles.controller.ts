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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Vehicles')
@ApiBearerAuth('JWT')
@Controller('vehicles')
export class VehiclesController {
  constructor(private vehicles: VehiclesService) {}

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
