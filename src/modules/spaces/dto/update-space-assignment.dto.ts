import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSpaceAssignmentDto {
  @IsOptional()
  @IsString()
  spaceId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assigneeType?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  assigneeId?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;
}
