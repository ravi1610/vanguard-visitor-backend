import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SettingsModule } from '../settings/settings.module';
import { SmsModule } from '../sms/sms.module';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    SettingsModule,
    SmsModule,
    ...(process.env.REDIS_URL
      ? [BullModule.registerQueue({ name: 'sms' })]
      : []),
  ],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
