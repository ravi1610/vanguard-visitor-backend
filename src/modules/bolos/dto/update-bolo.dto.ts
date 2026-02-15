import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { BoloStatus, BoloPriority } from '@prisma/client';

export class UpdateBoloDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  personName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  vehicleMake?: string;

  @IsOptional()
  @IsString()
  vehicleModel?: string;

  @IsOptional()
  @IsString()
  vehicleColor?: string;

  @IsOptional()
  @IsString()
  vehicleDescription?: string;

  @IsOptional()
  @IsString()
  licensePlate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(BoloStatus)
  status?: BoloStatus;

  @IsOptional()
  @IsEnum(BoloPriority)
  priority?: BoloPriority;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
