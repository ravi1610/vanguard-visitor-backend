import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'List all users with pagination' })
  @ApiQuery({ name: 'roleKey', required: false, description: 'Filter by role key' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status (true/false)' })
  @ApiQuery({ name: 'isBoardMember', required: false, description: 'Filter by board member status (true/false)' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('roleKey') roleKey?: string,
    @Query('isActive') isActive?: string,
    @Query('isBoardMember') isBoardMember?: string,
  ) {
    return this.users.findAll(
      tenantId, roleKey, query,
      isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      isBoardMember === 'true' ? true : isBoardMember === 'false' ? false : undefined,
    );
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Get a user by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.users.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Create a new user' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateUserDto) {
    return this.users.create(user.tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Update a user' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Delete a user' })
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.users.remove(tenantId, id);
  }

  @Post(':id/photo')
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Upload user photo' })
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
        destination: './uploads/photos',
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
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
    const photoUrl = `/uploads/photos/${file.filename}`;
    return this.users.updatePhoto(tenantId, id, photoUrl);
  }

  @Post(':id/roles/:roleId')
  @UseGuards(PermissionsGuard)
  @Permissions('user.manage')
  @ApiOperation({ summary: 'Assign a role to a user' })
  assignRole(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ) {
    return this.users.assignRole(tenantId, id, roleId);
  }
}
