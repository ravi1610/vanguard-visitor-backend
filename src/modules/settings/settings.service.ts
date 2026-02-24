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

  // ── Test Connections ────────────────────────────────────────────

  /** Test S3 bucket connectivity */
  async testS3Connection(): Promise<{ success: boolean; message: string }> {
    try {
      const bucket = await this.getSystemSettingRaw('s3.bucket');
      const region = await this.getSystemSettingRaw('s3.region');
      const accessKeyId = await this.getSystemSettingRaw('s3.accessKeyId');
      const secretAccessKey = await this.getSystemSettingRaw(
        's3.secretAccessKey',
      );
      const endpoint = await this.getSystemSettingRaw('s3.endpoint');

      if (!bucket || !region || !accessKeyId || !secretAccessKey) {
        return {
          success: false,
          message:
            'Missing required S3 settings (bucket, region, access key, secret key)',
        };
      }

      const { S3Client, HeadBucketCommand } = await import(
        '@aws-sdk/client-s3'
      );
      const client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      });

      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return {
        success: true,
        message: `Successfully connected to bucket "${bucket}"`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'S3 connection failed',
      };
    }
  }

  /** Test SMTP email connectivity */
  async testEmailConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const host = await this.getSystemSettingRaw('email.smtpHost');
      const port = await this.getSystemSettingRaw('email.smtpPort');
      const user = await this.getSystemSettingRaw('email.smtpUser');
      const pass = await this.getSystemSettingRaw('email.smtpPass');
      const fromAddress = await this.getSystemSettingRaw('email.fromAddress');

      if (!host || !port) {
        return {
          success: false,
          message: 'Missing required email settings (SMTP host, port)',
        };
      }

      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10),
        secure: parseInt(port, 10) === 465,
        auth: user && pass ? { user, pass } : undefined,
      });

      await transporter.verify();

      // Send test email to support address if configured
      const supportEmail = await this.getSystemSettingRaw(
        'general.supportEmail',
      );
      if (supportEmail) {
        await transporter.sendMail({
          from: fromAddress || user || 'test@example.com',
          to: supportEmail,
          subject: 'Vanguard Visitor - Test Email',
          text: 'This is a test email from Vanguard Visitor settings. If you received this, email is configured correctly.',
        });
        return {
          success: true,
          message: `SMTP verified and test email sent to ${supportEmail}`,
        };
      }

      return { success: true, message: 'SMTP connection verified successfully' };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Email connection test failed',
      };
    }
  }

  /** Test Twilio SMS connectivity */
  async testSmsConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const accountSid = await this.getSystemSettingRaw('twilio.accountSid');
      const authToken = await this.getSystemSettingRaw('twilio.authToken');
      const fromNumber = await this.getSystemSettingRaw('twilio.fromNumber');

      if (!accountSid || !authToken || !fromNumber) {
        return {
          success: false,
          message:
            'Missing required Twilio settings (Account SID, Auth Token, From Number)',
        };
      }

      const twilio = await import('twilio');
      const client = twilio.default(accountSid, authToken);

      const account = await client.api.accounts(accountSid).fetch();
      return {
        success: true,
        message: `Connected to Twilio account "${account.friendlyName}" (${account.status})`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Twilio connection test failed',
      };
    }
  }
}
