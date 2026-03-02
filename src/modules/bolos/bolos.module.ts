import { Module } from '@nestjs/common';
import { BolosService } from './bolos.service';
import { BolosController } from './bolos.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [BolosController],
  providers: [BolosService],
  exports: [BolosService],
})
export class BolosModule {}
