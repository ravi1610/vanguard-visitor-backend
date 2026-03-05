import { IsString, IsOptional, IsEmail, IsEnum, MinLength, IsDateString } from 'class-validator';

export enum SendVia {
  sms = 'sms',
  email = 'email',
  both = 'both',
}

export class ResidentScheduleVisitDto {
  @IsString()
  @MinLength(1)
  visitorName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsDateString()
  arrivalDate: string;

  @IsOptional()
  @IsDateString()
  arrivalEndDate?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsEnum(SendVia)
  sendVia: SendVia;
}
