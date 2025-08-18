import { PaymentMethod } from 'src/common/enums/payment-method.enum';

export interface PaymentDetailDto {
  bankName?: string;
  transactionReference: string;
  transactionDate: string;
  amount: number;
  fileIndex: number;
}

export interface CreateReconsumptionDto {
  paymentMethod: PaymentMethod;
  membershipId: number;
  payments?: PaymentDetailDto[];
  source_id?: string;
}

export interface CreateReconsumptionPayload {
  userId: string;
  dto: CreateReconsumptionDto;
  files: Array<{
    originalname: string;
    buffer: Buffer;
    mimetype: string;
    size: number;
  }>;
}
