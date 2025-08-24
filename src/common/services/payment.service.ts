import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { catchError, firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import { PaymentProcessResponse } from '../interfaces/payment-response.interface';

@Injectable()
export class PaymentService {
  private readonly paymentClient: ClientProxy;

  constructor() {
    this.paymentClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async processPayment(paymentData: any): Promise<PaymentProcessResponse> {
    return await firstValueFrom(
      this.paymentClient
        .send<PaymentProcessResponse>(
          { cmd: 'payment.createPayment' },
          paymentData,
        )
        .pipe(
          catchError((error) => {
            if (error instanceof RpcException) throw error;
            const err = error as {
              message?: string | string[];
              status?: number;
              service?: string;
            };

            // Determinamos el mensaje del error
            let errorMessage: string[];
            if (Array.isArray(err?.message)) {
              errorMessage = err.message;
            } else if (typeof err?.message === 'string') {
              errorMessage = [err.message];
            } else {
              errorMessage = ['Error al procesar el pago'];
            }

            const statusCode =
              typeof err?.status === 'number'
                ? err.status
                : HttpStatus.INTERNAL_SERVER_ERROR;

            const service = err?.service || 'ms-nexus-payment';

            throw new RpcException({
              status: statusCode,
              message: errorMessage,
              service,
            });
          }),
        ),
    );
  }
}
