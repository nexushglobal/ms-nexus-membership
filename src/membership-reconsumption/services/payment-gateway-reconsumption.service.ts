import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { PointsService } from 'src/common/services/points.service';
import { UsersService } from 'src/common/services/users.service';
import { Membership } from 'src/membership/entities/membership.entity';
import { Repository } from 'typeorm';
import { CreateReconsumptionDto } from '../dto/create-membership-reconsumtion.dto';
import { MembershipReconsumption } from '../entities/membership-reconsumption.entity';
import { BaseReconsumptionService } from './base-reconsumption.service';

@Injectable()
export class PaymentGatewayReconsumptionService extends BaseReconsumptionService {
  protected readonly logger = new Logger(
    PaymentGatewayReconsumptionService.name,
  );

  constructor(
    @InjectRepository(MembershipReconsumption)
    reconsumptionRepository: Repository<MembershipReconsumption>,
    @InjectRepository(Membership)
    membershipRepository: Repository<Membership>,
    pointsService: PointsService,
    usersService: UsersService,
  ) {
    super(
      reconsumptionRepository,
      membershipRepository,
      pointsService,
      usersService,
    );
  }

  async processReconsumption(
    userId: string,
    createDto: CreateReconsumptionDto,
  ): Promise<any> {
    this.logger.log(
      `Procesando reconsumo PAYMENT_GATEWAY para usuario ${userId}`,
    );

    try {
      // 1. Obtener información del usuario
      const userInfo = await this.getUserInfo(userId);

      // 2. Obtener la membresía del usuario
      const membership = await this.getUserMembership(
        userId,
        createDto.membershipId,
      );

      // 3. El monto debe ser igual al mínimo de reconsumo
      const amount = membership.minimumReconsumptionAmount;

      // 4. Crear el registro de reconsumo
      const reconsumption = await this.createReconsumptionRecord(
        membership,
        amount,
        {
          paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
          source_id: createDto.source_id,
        },
      );

      // 5. Crear el pago
      try {
        const payment = await this.createPayment({
          userId,
          userEmail: userInfo.email,
          username: userInfo.fullName,
          amount,
          paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
          relatedEntityType: 'membership_reconsumption',
          relatedEntityId: reconsumption.id,
          metadata: {
            membershipId: membership.id,
            planName: membership.plan.name,
            reconsumptionType: 'PAYMENT_GATEWAY',
          },
          source_id: createDto.source_id,
        });

        // 6. Actualizar el reconsumo con la referencia del pago
        await this.updateReconsumptionWithPayment(
          reconsumption.id,
          String(payment.paymentId || payment.reference || ''),
        );

        this.logger.log(
          `Reconsumo PAYMENT_GATEWAY creado exitosamente para usuario ${userId}`,
        );

        return {
          reconsumption,
          payment,
          totalAmount: amount,
        };
      } catch (paymentError) {
        // Rollback en caso de error en el pago
        await this.rollbackReconsumption(reconsumption.id);
        throw paymentError;
      }
    } catch (error) {
      this.logger.error(
        `Error al procesar reconsumo PAYMENT_GATEWAY: ${error.message}`,
      );
      throw error;
    }
  }
}
