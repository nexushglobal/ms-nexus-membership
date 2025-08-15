export class GetMembershipDetailResponseDto {
  membership: {
    status: string;
    startDate: Date;
    endDate: Date;
    paidAmount: number;
    plan: {
      name: string;
      price: number;
      directCommissionAmount?: number;
      commissionPercentage: number;
    };
  };
  lastReconsumption?: {
    amount: number;
    periodDate: Date;
    createdAt: Date;
  } | null;
  pendingReconsumption?: {
    amount: number;
    periodDate: Date;
    createdAt: Date;
  } | null;
  canReconsume: boolean;
}
