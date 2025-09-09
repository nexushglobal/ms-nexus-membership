import { MembershipReconsumption } from '../entities/membership-reconsumption.entity';

export interface ReconsumptionResponse {
  reconsumption: MembershipReconsumption;
  totalAmount: number;
  paymentId?: string; // Solo voucher y points lo tienen
  payment?: any; // Solo payment-gateway lo tiene
}