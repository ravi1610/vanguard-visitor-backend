import { Module } from '@nestjs/common';
import { ReportSchedulesController } from './report-schedules.controller.js';
import { ReportSchedulesService } from './report-schedules.service.js';
import { ReportsModule } from '../reports/reports.module.js';

@Module({
  imports: [ReportsModule],
  controllers: [ReportSchedulesController],
  providers: [ReportSchedulesService],
})
export class ReportSchedulesModule {}
