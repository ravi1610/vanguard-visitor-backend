import { Module } from '@nestjs/common';
import { ViolationsService } from './violations.service';
import { ViolationsController } from './violations.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ViolationsController],
  providers: [ViolationsService],
  exports: [ViolationsService],
})
export class ViolationsModule {}
