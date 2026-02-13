import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CheckInDto {
  @IsUUID()
  visitorId: string;

  @IsUUID()
  hostUserId: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  location?: string;
}
