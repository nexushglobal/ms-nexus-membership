import { IsNotEmpty, IsString } from 'class-validator';

export class GetUserMembershipByUserIdDto {
  @IsNotEmpty()
  @IsString()
  userId: string;
}

export class UserMembershipPlanDto {
  id: number;
  name: string;
  commissionPercentage: number;
  directCommissionAmount?: number;
  binaryPoints?: number;
}

export class GetUserMembershipByUserIdResponseDto {
  id?: number;
  userId?: string;
  userName?: string;
  userEmail?: string;
  plan?: UserMembershipPlanDto;
  message?: string;
  hasActiveMembership: boolean;
}
