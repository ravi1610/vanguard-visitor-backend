import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { encrypt, decrypt } from '../../common/utils/encryption';

const SECRET_MASK = '••••••••';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return (
      this.config.get<string>('settings.encryptionKey') ||
      'dev-only-32-char-key-change-me!!'
    );
  }

  // ── System Settings ─────────────────────────────────────────────

  /** Get all system settings, masking secret values */
  async getSystemSettings() {
    const settings = await this.prisma.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    return settings.map((s) => ({
      ...s,
      value: s.isSecret ? SECRET_MASK : s.value,
    }));
  }

  /** Get raw decrypted value of a system setting (for internal use) */
  async getSystemSettingRaw(key: string): Promise<string | null> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    if (!setting) return null;
    if (setting.isSecret) {
      try {
        return decrypt(setting.value, this.encryptionKey);
      } catch {
        return null;
      }
    }
    return setting.value;
  }

  /** Upsert a system setting */
  async upsertSystemSetting(
    key: string,
    value: string,
    isSecret = false,
    category = 'general',
    label?: string,
  ) {
    const storedValue = isSecret
      ? encrypt(value, this.encryptionKey)
      : value;

    const setting = await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: storedValue, isSecret, category, label },
      update: { value: storedValue, isSecret, category, label },
    });

    return {
      ...setting,
      value: setting.isSecret ? SECRET_MASK : setting.value,
    };
  }

  /** Delete a system setting */
  async deleteSystemSetting(key: string) {
    return this.prisma.systemSetting.delete({ where: { key } });
  }

  // ── Tenant Settings ─────────────────────────────────────────────

  /** Get all settings for a tenant */
  async getTenantSettings(tenantId: string) {
    return this.prisma.tenantSetting.findMany({
      where: { tenantId },
      orderBy: { key: 'asc' },
    });
  }

  /** Upsert a tenant setting */
  async upsertTenantSetting(tenantId: string, key: string, value: string) {
    return this.prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, value },
      update: { value },
    });
  }

  /** Delete a tenant setting */
  async deleteTenantSetting(tenantId: string, key: string) {
    return this.prisma.tenantSetting.delete({
      where: { tenantId_key: { tenantId, key } },
    });
  }
}
