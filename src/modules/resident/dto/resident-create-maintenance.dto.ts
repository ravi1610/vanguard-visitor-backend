import { IsString, IsOptional, MinLength, IsDateString } from 'class-validator';

export class ResidentCreateMaintenanceDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
