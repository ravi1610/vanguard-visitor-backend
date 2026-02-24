import { PartialType } from '@nestjs/swagger';
import { CreateReportScheduleDto } from './create-report-schedule.dto.js';

export class UpdateReportScheduleDto extends PartialType(CreateReportScheduleDto) {}
