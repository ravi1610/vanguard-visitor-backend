import { IsString, IsArray, IsBoolean, IsOptional, IsObject, ArrayMinSize } from 'class-validator';

export class CreateReportScheduleDto {
  @IsString()
  name!: string;

  @IsString()
  reportType!: string;

  @IsObject()
  @IsOptional()
  filters?: Record<string, string | undefined>;

  @IsString()
  cronExpr!: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  recipients!: string[];

  @IsString()
  @IsOptional()
  format?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
