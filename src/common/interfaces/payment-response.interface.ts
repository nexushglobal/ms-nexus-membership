export interface PaymentProcessResponse {
  success: boolean;
  paymentId: string;
  pointsTransactionId: string;
  message: string;
  remainingPoints: number;
}
