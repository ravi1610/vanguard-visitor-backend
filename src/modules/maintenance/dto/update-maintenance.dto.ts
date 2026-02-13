import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { MaintenanceStatus } from '@prisma/client';

export class UpdateMaintenanceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @IsOptional()
  @IsString()
  assignedToUserId?: string;

  @IsOptional()
  @IsString()
  propertyUnit?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}
