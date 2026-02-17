import { IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { ViolationType, ViolationStatus } from '@prisma/client';

export class CreateViolationDto {
  @IsString()
  @MinLength(1)
  userId: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsString()
  @MinLength(1)
  title: string;

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

  @IsString()
  issuedDate: string;

  @IsOptional()
  @IsString()
  resolvedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
