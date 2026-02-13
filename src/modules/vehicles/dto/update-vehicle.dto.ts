import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { VehicleOwnerType } from '@prisma/client';

export class UpdateVehicleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  plateNumber?: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsEnum(VehicleOwnerType)
  ownerType?: VehicleOwnerType;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
