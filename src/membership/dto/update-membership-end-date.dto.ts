import { IsDateString, IsString } from 'class-validator';

export class UpdateMembershipEndDateDto {
  @IsString()
  membershipId: string;

  @IsDateString()
  endDate: string;
}

export class UpdateMembershipEndDateResponseDto {
  id: number;
  endDate: Date;
  message: string;
}
