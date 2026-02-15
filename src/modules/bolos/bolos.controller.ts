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
import { BolosService } from './bolos.service';
import { CreateBoloDto } from './dto/create-bolo.dto';
import { UpdateBoloDto } from './dto/update-bolo.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('BOLOs')
@ApiBearerAuth('JWT')
@Controller('bolos')
export class BolosController {
  constructor(private bolos: BolosService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('bolos.view')
  @ApiOperation({ summary: 'List all BOLO alerts with pagination' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (active, resolved, expired)',
  })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('status') status?: string,
  ) {
    return this.bolos.findAll(tenantId, query, status);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('bolos.view')
  @ApiOperation({ summary: 'Get a BOLO alert by ID' })
  findOne(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.bolos.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('bolos.manage')
  @ApiOperation({ summary: 'Create a new BOLO alert' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateBoloDto,
  ) {
    return this.bolos.create(tenantId, dto, userId);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('bolos.manage')
  @ApiOperation({ summary: 'Update a BOLO alert' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBoloDto,
  ) {
    return this.bolos.update(tenantId, id, dto);
  }

  @Post(':id/resolve')
  @UseGuards(PermissionsGuard)
  @Permissions('bolos.manage')
  @ApiOperation({ summary: 'Mark a BOLO alert as resolved' })
  resolve(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.bolos.resolve(tenantId, id, userId);
  }

  @Post(':id/photo')
  @UseGuards(PermissionsGuard)
  @Permissions('bolos.manage')
  @ApiOperation({ summary: 'Upload BOLO photo' })
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
        destination: './uploads/bolos',
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new Error('Only image files (JPG, PNG, GIF, WebP) are allowed'),
            false,
          );
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
    const photoUrl = `/uploads/bolos/${file.filename}`;
    return this.bolos.updatePhoto(tenantId, id, photoUrl);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('bolos.manage')
  @ApiOperation({ summary: 'Delete a BOLO alert' })
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.bolos.remove(tenantId, id);
  }
}
