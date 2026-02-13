import { IsBoolean, IsIn, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

const RESIDENT_TYPES = ['president', 'vice_president', 'treasurer', 'owner', 'renter'] as const;

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v != null && v !== '')
  @IsString()
  @IsIn(RESIDENT_TYPES, { message: 'residentType must be one of: president, vice_president, treasurer, owner, renter' })
  residentType?: (typeof RESIDENT_TYPES)[number] | null;

  @IsOptional()
  @IsString()
  movingDate?: string;

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
  unit?: string;

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
