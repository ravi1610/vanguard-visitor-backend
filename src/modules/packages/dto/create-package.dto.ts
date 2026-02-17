import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PackageSize } from '@prisma/client';

export class CreatePackageDto {
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsEnum(PackageSize)
  size?: PackageSize;

  @IsOptional()
  @IsString()
  recipientId?: string;

  @IsString()
  @MinLength(1)
  recipientName: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  storageLocation?: string;

  @IsOptional()
  @IsBoolean()
  isPerishable?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
