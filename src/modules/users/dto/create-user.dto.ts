import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const RESIDENT_TYPES = ['president', 'vice_president', 'treasurer', 'owner', 'renter'] as const;

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;

  @IsString()
  @MinLength(1)
  firstName: string;

  @IsString()
  @MinLength(1)
  lastName: string;

  @IsOptional()
  @IsString()
  roleKey?: string;

  @IsOptional()
  @IsString()
  @IsIn(RESIDENT_TYPES, { message: 'residentType must be one of: president, vice_president, treasurer, owner, renter' })
  residentType?: (typeof RESIDENT_TYPES)[number];

  @IsOptional()
  @IsString()
  movingDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isHandicapped?: boolean;

  @IsOptional()
  @IsBoolean()
  isBoardMember?: boolean;

  @IsOptional()
  @IsBoolean()
  optInElectronicCommunications?: boolean;

  @IsOptional()
  @IsString()
  otherContactInfo?: string;

  @IsOptional()
  @IsString()
  workInfo?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  leaseBeginDate?: string;

  @IsOptional()
  @IsString()
  leaseEndDate?: string;
}
