import { IsDateString, IsOptional } from 'class-validator';

export class FindExpiredMembershipsDto {
  @IsDateString()
  currentDate: string;

  @IsOptional()
  @IsDateString()
  maxEndDate?: string;
}

export class ExpiredMembershipResponseDto {
  id: number;
  userId: string;
  userEmail: string;
  userName: string;
  isPointLot: boolean;
  autoRenewal: boolean;
  minimumReconsumptionAmount: number;
  startDate: Date;
  endDate: Date;
  plan?: {
    id: number;
    name: string;
    binaryPoints: number;
  };
}
