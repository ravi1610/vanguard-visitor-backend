import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SettingsModule } from '../settings/settings.module';
import { SmsService } from './sms.service';
import { SmsProcessor } from './sms.processor';
import { SmsController } from './sms.controller';
import { SinchProvider } from './providers/sinch.provider';
import { TwilioProvider } from './providers/twilio.provider';

@Module({
  imports: [
    SettingsModule,
    ...(process.env.REDIS_URL
      ? [BullModule.registerQueue({ name: 'sms' })]
      : []),
  ],
  controllers: [SmsController],
  providers: [
    SmsService,
    SinchProvider,
    TwilioProvider,
    ...(process.env.REDIS_URL ? [SmsProcessor] : []),
  ],
  exports: [SmsService],
})
export class SmsModule {}
