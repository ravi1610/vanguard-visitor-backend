import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { SmsProvider, SmsResult } from '../sms-provider.interface';

@Injectable()
export class TwilioProvider implements SmsProvider {
  readonly name = 'twilio' as const;

  constructor(private settings: SettingsService) {}

  async send(to: string, body: string): Promise<SmsResult> {
    const [accountSid, authToken, fromNumber] = await Promise.all([
      this.settings.getSystemSettingRaw('twilio.accountSid'),
      this.settings.getSystemSettingRaw('twilio.authToken'),
      this.settings.getSystemSettingRaw('twilio.fromNumber'),
    ]);

    if (!accountSid || !authToken || !fromNumber) {
      return { success: false, provider: 'twilio', error: 'Twilio credentials not configured' };
    }

    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);
    const message = await client.messages.create({ body, from: fromNumber, to });
    return { success: true, provider: 'twilio', messageId: message.sid };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const [accountSid, authToken] = await Promise.all([
      this.settings.getSystemSettingRaw('twilio.accountSid'),
      this.settings.getSystemSettingRaw('twilio.authToken'),
    ]);

    if (!accountSid || !authToken) {
      return { success: false, message: 'Missing Twilio credentials (Account SID, Auth Token)' };
    }

    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);
    const account = await client.api.accounts(accountSid).fetch();
    return {
      success: true,
      message: `Connected to Twilio "${account.friendlyName}" (${account.status})`,
    };
  }
}
