import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { SinchProvider } from './providers/sinch.provider';
import { TwilioProvider } from './providers/twilio.provider';
import { SmsProvider, SmsResult } from './sms-provider.interface';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private settings: SettingsService,
    private sinch: SinchProvider,
    private twilio: TwilioProvider,
  ) {}

  /** Get provider order based on admin configuration */
  private async getProviderOrder(): Promise<SmsProvider[]> {
    const primary = await this.settings.getSystemSettingRaw('sms.primaryProvider');
    if (primary === 'twilio') {
      return [this.twilio, this.sinch];
    }
    return [this.sinch, this.twilio];
  }

  /** Send SMS with automatic failover */
  async send(to: string, body: string): Promise<SmsResult> {
    const providers = await this.getProviderOrder();

    for (const provider of providers) {
      try {
        const result = await provider.send(to, body);
        if (result.success) {
          this.logger.log(`SMS sent via ${provider.name} to ${to}`);
          return result;
        }
        this.logger.warn(`${provider.name} failed: ${result.error}, trying next provider...`);
      } catch (err: any) {
        this.logger.warn(`${provider.name} threw error: ${err.message}, trying next provider...`);
      }
    }

    return {
      success: false,
      provider: providers[providers.length - 1].name,
      error: 'All SMS providers failed',
    };
  }

  /** Test a specific provider connection */
  async testProvider(provider: 'sinch' | 'twilio'): Promise<{ success: boolean; message: string }> {
    try {
      if (provider === 'sinch') return await this.sinch.testConnection();
      return await this.twilio.testConnection();
    } catch (err: any) {
      return { success: false, message: err.message || `${provider} connection test failed` };
    }
  }
}
