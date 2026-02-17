import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { MaintenanceStatus } from '@prisma/client';

export class CreateMaintenanceDto {
  @IsString()
  @MinLength(1)
  title: string;

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
  unitId?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}
