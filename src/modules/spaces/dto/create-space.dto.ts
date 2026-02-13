import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { SpaceType } from '@prisma/client';

export class CreateSpaceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsEnum(SpaceType)
  type?: SpaceType;
}
