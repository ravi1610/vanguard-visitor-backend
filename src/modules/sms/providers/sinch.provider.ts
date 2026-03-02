import { Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { SmsProvider, SmsResult } from '../sms-provider.interface';

@Injectable()
export class SinchProvider implements SmsProvider {
  readonly name = 'sinch' as const;

  constructor(private settings: SettingsService) {}

  async send(to: string, body: string): Promise<SmsResult> {
    const [servicePlanId, apiToken, fromNumber] = await Promise.all([
      this.settings.getSystemSettingRaw('sinch.servicePlanId'),
      this.settings.getSystemSettingRaw('sinch.apiToken'),
      this.settings.getSystemSettingRaw('sinch.fromNumber'),
    ]);

    if (!servicePlanId || !apiToken || !fromNumber) {
      return { success: false, provider: 'sinch', error: 'Sinch credentials not configured' };
    }

    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}/xms/v1/${servicePlanId}/batches`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ from: fromNumber, to: [to], body }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return { success: false, provider: 'sinch', error: `Sinch API ${response.status}: ${errBody}` };
    }

    const data = await response.json();
    return { success: true, provider: 'sinch', messageId: data.id };
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const [servicePlanId, apiToken] = await Promise.all([
      this.settings.getSystemSettingRaw('sinch.servicePlanId'),
      this.settings.getSystemSettingRaw('sinch.apiToken'),
    ]);

    if (!servicePlanId || !apiToken) {
      return { success: false, message: 'Missing Sinch credentials (Service Plan ID, API Token)' };
    }

    const baseUrl = await this.getBaseUrl();
    const url = `${baseUrl}/xms/v1/${servicePlanId}/batches?page_size=1`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!response.ok) {
      return { success: false, message: `Sinch API returned ${response.status}` };
    }

    return { success: true, message: 'Connected to Sinch SMS API successfully' };
  }

  private async getBaseUrl(): Promise<string> {
    const region = (await this.settings.getSystemSettingRaw('sinch.region')) || 'us';
    return region === 'eu'
      ? 'https://eu.sms.api.sinch.com'
      : 'https://sms.api.sinch.com';
  }
}
