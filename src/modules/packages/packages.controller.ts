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
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Packages')
@ApiBearerAuth('JWT')
@Controller('packages')
export class PackagesController {
  constructor(private packages: PackagesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('packages.view')
  @ApiOperation({ summary: 'List all packages with pagination' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
  ) {
    return this.packages.findAll(tenantId, query, status);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('packages.view')
  @ApiOperation({ summary: 'Get a package by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.packages.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('packages.manage')
  @ApiOperation({ summary: 'Log a new package' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreatePackageDto,
  ) {
    return this.packages.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('packages.manage')
  @ApiOperation({ summary: 'Update a package' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.packages.update(tenantId, id, dto);
  }

  @Post(':id/pickup')
  @UseGuards(PermissionsGuard)
  @Permissions('packages.manage')
  @ApiOperation({ summary: 'Mark a package as picked up' })
  pickup(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.packages.pickup(tenantId, id, userId);
  }

  @Post(':id/photo')
  @UseGuards(PermissionsGuard)
  @Permissions('packages.manage')
  @ApiOperation({ summary: 'Upload package photo' })
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
        destination: './uploads/packages',
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
    const photoUrl = `/uploads/packages/${file.filename}`;
    return this.packages.updatePhoto(tenantId, id, photoUrl);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('packages.manage')
  @ApiOperation({ summary: 'Delete a package' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.packages.remove(tenantId, id);
  }
}
