import { IsString, MinLength } from 'class-validator';

export class CreateSpaceAssignmentDto {
  @IsString()
  spaceId: string;

  @IsString()
  @MinLength(1)
  assigneeType: string;

  @IsString()
  @MinLength(1)
  assigneeId: string;

  @IsString()
  fromDate: string;

  @IsString()
  toDate: string;
}
