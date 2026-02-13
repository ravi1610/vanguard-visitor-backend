import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class ScheduleVisitDto {
  @IsUUID()
  visitorId: string;

  @IsUUID()
  hostUserId: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @IsOptional()
  @IsBoolean()
  generateQr?: boolean;
}
