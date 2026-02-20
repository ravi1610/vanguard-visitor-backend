import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ReportsProcessor } from './reports.processor';

@Module({
  imports: [
    // Register queue only when Redis is available (BullModule.forRoot is registered in AppModule)
    ...(process.env.REDIS_URL
      ? [BullModule.registerQueue({ name: 'reports' })]
      : []),
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    // Register processor only when Redis is available
    ...(process.env.REDIS_URL ? [ReportsProcessor] : []),
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
