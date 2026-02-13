import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SpaceType } from '@prisma/client';

export class UpdateSpaceDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(SpaceType)
  type?: SpaceType;
}
