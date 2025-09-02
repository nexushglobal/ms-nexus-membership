import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { envs } from 'src/config/envs';
import { PAYMENT_SERVICE } from 'src/config/services';
import { OrdersService } from './services/orders.service';
import { PaymentService } from './services/payment.service';
import { PointsService } from './services/points.service';
import { UsersService } from './services/users.service';

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
      {
        name: 'NATS_SERVICE',
        transport: Transport.NATS,
        options: {
          servers: envs.NATS_SERVERS,
        },
      },
    ]),
  ],
  providers: [PaymentService, OrdersService, PointsService, UsersService],
  exports: [
    ClientsModule,
    PaymentService,
    OrdersService,
    PointsService,
    UsersService,
  ],
})
export class CommonModule {}
