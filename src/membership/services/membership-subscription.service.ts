import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { CreateSubscriptionPayload } from '../dto/create-membership-subscription.dto';
import { PaymentGatewaySubscriptionService } from './subscription/payment-gateway-subscription.service';
import { PointsSubscriptionService } from './subscription/points-subscription.service';
import { VoucherSubscriptionService } from './subscription/voucher-subscription.service';

@Injectable()
export class MembershipSubscriptionService {
  private readonly logger = new Logger(MembershipSubscriptionService.name);

  constructor(
    private readonly voucherSubscriptionService: VoucherSubscriptionService,
    private readonly pointsSubscriptionService: PointsSubscriptionService,
    private readonly paymentGatewaySubscriptionService: PaymentGatewaySubscriptionService,
  ) {}

  async createSubscription({
    createDto,
    files,
    userId,
  }: CreateSubscriptionPayload): Promise<any> {
    this.logger.log(
      `Creando suscripción para usuario ${userId} con método ${createDto.paymentMethod}`,
    );

    if (!Object.values(PaymentMethod).includes(createDto.paymentMethod)) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Método de pago no válido',
      });
    }

    try {
      switch (createDto.paymentMethod) {
        case PaymentMethod.VOUCHER:
          if (!createDto.payments || createDto.payments.length === 0) {
            throw new RpcException({
              status: HttpStatus.BAD_REQUEST,
              message:
                'Para el método VOUCHER se requieren los detalles de pago',
            });
          }
          return await this.voucherSubscriptionService.processSubscription(
            userId,
            createDto,
            files,
          );

        case PaymentMethod.POINTS:
          return await this.pointsSubscriptionService.processSubscription(
            userId,
            createDto,
            files,
          );

        case PaymentMethod.PAYMENT_GATEWAY:
          if (!createDto.source_id) {
            throw new RpcException({
              status: HttpStatus.BAD_REQUEST,
              message:
                'Para el método PAYMENT_GATEWAY se requiere el source_id',
            });
          }
          return await this.paymentGatewaySubscriptionService.processSubscription(
            userId,
            createDto,
          );

        default:
          throw new RpcException({
            status: HttpStatus.BAD_REQUEST,
            message: 'Método de pago no soportado',
          });
      }
    } catch {
      this.logger.error(`Error al crear suscripción`);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al procesar la suscripción',
      });
    }
  }
}
