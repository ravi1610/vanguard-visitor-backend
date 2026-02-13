import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCalendarEventDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  startAt: string;

  @IsString()
  endAt: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
