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
export class VoucherReconsumptionService extends BaseReconsumptionService {
  protected readonly logger = new Logger(VoucherReconsumptionService.name);

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
    files: Array<{
      originalname: string;
      buffer: Buffer;
      mimetype: string;
      size: number;
    }>,
  ): Promise<any> {
    this.logger.log(`Procesando reconsumo VOUCHER para usuario ${userId}`);

    try {
      // 1. Obtener información del usuario
      const userInfo = await this.getUserInfo(userId);

      // 2. Obtener la membresía del usuario
      const membership = await this.getUserMembership(
        userId,
        createDto.membershipId,
      );

      // 3. Validar que el monto total sea igual al mínimo de reconsumo
      const totalAmount =
        createDto.payments?.reduce((sum, payment) => sum + payment.amount, 0) ||
        0;

      if (totalAmount !== membership.minimumReconsumptionAmount) {
        throw new Error(
          `El monto total (${totalAmount}) debe ser igual al monto mínimo de reconsumo (${membership.minimumReconsumptionAmount})`,
        );
      }

      // 4. Crear el registro de reconsumo
      const reconsumption = await this.createReconsumptionRecord(
        membership,
        totalAmount,
        {
          paymentMethod: PaymentMethod.VOUCHER,
          payments: createDto.payments,
        },
      );

      // 5. Crear el pago
      try {
        const payment = await this.createPayment({
          userId,
          userEmail: userInfo.email,
          username: userInfo.fullName,
          amount: totalAmount,
          paymentMethod: PaymentMethod.VOUCHER,
          relatedEntityType: 'membership_reconsumption',
          relatedEntityId: reconsumption.id,
          metadata: {
            'Plan Actual': membership.plan.name,
            Tipo: membership.isPointLot
              ? 'puntos de lote'
              : 'pago de ordinario',
          },
          payments: createDto.payments,
          files,
        });

        // 6. Actualizar el reconsumo con la referencia del pago
        await this.updateReconsumptionWithPayment(
          reconsumption.id,
          String(payment.paymentId || payment.reference || ''),
        );

        this.logger.log(
          `Reconsumo VOUCHER creado exitosamente para usuario ${userId}`,
        );

        return {
          reconsumption,
          paymentId: payment.paymentId || '',
          totalAmount,
        };
      } catch (paymentError) {
        // Rollback en caso de error en el pago
        await this.rollbackReconsumption(reconsumption.id);
        throw paymentError;
      }
    } catch (error) {
      this.logger.error(
        `Error al procesar reconsumo VOUCHER: ${error.message}`,
      );
      throw error;
    }
  }
}
