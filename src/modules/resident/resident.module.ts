import { Module } from '@nestjs/common';
import { ResidentController } from './resident.controller';
import { ResidentService } from './resident.service';
import { SmsModule } from '../sms/sms.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [SmsModule, EmailModule],
  controllers: [ResidentController],
  providers: [ResidentService],
})
export class ResidentModule {}
