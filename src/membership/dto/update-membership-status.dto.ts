import { IsEnum, IsString } from 'class-validator';
import { MembershipStatus } from '../entities/membership.entity';

export class UpdateMembershipStatusDto {
  @IsString()
  membershipId: string;

  @IsEnum(MembershipStatus)
  status: MembershipStatus;
}

export class UpdateMembershipStatusResponseDto {
  id: number;
  status: MembershipStatus;
  message: string;
}
