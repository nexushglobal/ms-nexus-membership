export class GetMembershipDetailResponseDto {
  membership: {
    id: number;
    status: string;
    startDate: Date;
    endDate: Date;
    autoRenewal: boolean;
    paidAmount: number;
    plan: {
      id: number;
      name: string;
      price: number;
      binaryPoints: number;
      checkAmount: number;
      commissionPercentage: number;
    };
  };
  lastReconsumption?: {
    id: number;
    amount: number;
    status: string;
    periodDate: Date;
    createdAt: Date;
  } | null;
  pendingReconsumption?: {
    id: number;
    amount: number;
    status: string;
    periodDate: Date;
    createdAt: Date;
  } | null;
  canReconsume: boolean;
}
