import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PAYMENT_SERVICE } from 'src/config/services';
import { envs } from 'src/config/envs';
import { PaymentService } from './services/payment.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: PAYMENT_SERVICE,
        transport: Transport.NATS,
        options: {
          servers: envs.NATS_SERVERS,
        },
      },
    ]),
  ],
  providers: [PaymentService],
  exports: [ClientsModule, PaymentService],
})
export class CommonModule {}
