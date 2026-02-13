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
import { EmergencyContactsService } from './emergency-contacts.service';
import { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PagedQueryDto } from '../../common/dto/paged-query.dto';

@ApiTags('Emergency Contacts')
@ApiBearerAuth('JWT')
@Controller('emergency-contacts')
export class EmergencyContactsController {
  constructor(private emergencyContacts: EmergencyContactsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('emergencyContacts.view')
  @ApiOperation({ summary: 'List emergency contacts with pagination' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user/resident ID' })
  findAll(
    @CurrentUser('tenantId') tenantId: string,
    @Query() query: PagedQueryDto,
    @Query('userId') userId?: string,
  ) {
    return this.emergencyContacts.findAll(tenantId, query, userId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('emergencyContacts.view')
  @ApiOperation({ summary: 'Get an emergency contact by ID' })
  findOne(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.emergencyContacts.findOne(tenantId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('emergencyContacts.manage')
  @ApiOperation({ summary: 'Create an emergency contact' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateEmergencyContactDto,
  ) {
    return this.emergencyContacts.create(tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('emergencyContacts.manage')
  @ApiOperation({ summary: 'Update an emergency contact' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmergencyContactDto,
  ) {
    return this.emergencyContacts.update(tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('emergencyContacts.manage')
  @ApiOperation({ summary: 'Delete an emergency contact' })
  remove(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.emergencyContacts.remove(tenantId, id);
  }
}
