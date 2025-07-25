import { PaymentMethod } from 'src/common/enums/payment-method.enum';

export interface PaymentDetailDto {
  bankName?: string;
  transactionReference: string;
  transactionDate: string;
  amount: number;
  fileIndex: number;
}

export interface CreateMembershipSubscriptionDto {
  paymentMethod: PaymentMethod;
  planId: number;
  payments?: PaymentDetailDto[];
  source_id?: string;
}

export interface CreateSubscriptionPayload {
  userId: string;
  createDto: CreateMembershipSubscriptionDto;
  files: Array<{
    originalname: string;
    buffer: Buffer;
    mimetype: string;
    size: number;
  }>;
}
