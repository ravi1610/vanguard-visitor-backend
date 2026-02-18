import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import {
  UpsertSystemSettingDto,
  UpsertTenantSettingDto,
} from './dto/upsert-setting.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../common/guards/superadmin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Settings')
@ApiBearerAuth('JWT')
@Controller('settings')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SettingsController {
  constructor(private settings: SettingsService) {}

  // ── System Settings ─────────────────────────────────────────────

  @Get('system')
  @ApiOperation({ summary: 'List all system settings (secrets masked)' })
  getSystemSettings() {
    return this.settings.getSystemSettings();
  }

  @Put('system')
  @ApiOperation({ summary: 'Create or update a system setting' })
  upsertSystemSetting(@Body() dto: UpsertSystemSettingDto) {
    return this.settings.upsertSystemSetting(
      dto.key,
      dto.value,
      dto.isSecret,
      dto.category,
      dto.label,
    );
  }

  @Delete('system/:key')
  @ApiOperation({ summary: 'Delete a system setting' })
  deleteSystemSetting(@Param('key') key: string) {
    return this.settings.deleteSystemSetting(key);
  }

  // ── Tenant Settings ─────────────────────────────────────────────

  @Get('tenant')
  @ApiOperation({ summary: 'List all settings for the current tenant' })
  getTenantSettings(@CurrentUser('tenantId') tenantId: string) {
    return this.settings.getTenantSettings(tenantId);
  }

  @Put('tenant')
  @ApiOperation({ summary: 'Create or update a tenant setting' })
  upsertTenantSetting(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: UpsertTenantSettingDto,
  ) {
    return this.settings.upsertTenantSetting(tenantId, dto.key, dto.value);
  }

  @Delete('tenant/:key')
  @ApiOperation({ summary: 'Delete a tenant setting' })
  deleteTenantSetting(
    @CurrentUser('tenantId') tenantId: string,
    @Param('key') key: string,
  ) {
    return this.settings.deleteTenantSetting(tenantId, key);
  }
}
