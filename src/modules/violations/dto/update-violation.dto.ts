import { IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { ViolationType, ViolationStatus } from '@prisma/client';

export class UpdateViolationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ViolationType)
  type?: ViolationType;

  @IsOptional()
  @IsEnum(ViolationStatus)
  status?: ViolationStatus;

  @IsOptional()
  @IsNumber()
  fineAmount?: number;

  @IsOptional()
  @IsString()
  issuedDate?: string;

  @IsOptional()
  @IsString()
  resolvedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
