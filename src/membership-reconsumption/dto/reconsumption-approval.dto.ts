export interface ApproveReconsumptionDto {
  reconsumptionId: number;
  paymentId: number;
  amount: number;
  approvedAt: Date;
}

export interface ApproveReconsumptionResponseDto {
  reconsumptionId: number;
  newStartDate: Date;
  newEndDate: Date;
  minReconsumptionAmount: number;
  isPointLLot: boolean;
}

export interface RejectReconsumptionDto {
  reconsumptionId: number;
  paymentId: number;
  rejectedAt: Date;
}

export interface RejectReconsumptionResponseDto {
  reconsumptionId: number;
  paymentId: number;
  rejectedAt: Date;
}
