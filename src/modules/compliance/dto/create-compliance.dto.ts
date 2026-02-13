import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ComplianceStatus } from '@prisma/client';

export class CreateComplianceItemDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  dueDate: string;

  @IsOptional()
  @IsEnum(ComplianceStatus)
  status?: ComplianceStatus;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
