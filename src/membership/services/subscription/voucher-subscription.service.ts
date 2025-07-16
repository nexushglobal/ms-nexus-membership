import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { MembershipPlan } from 'src/membership-plan/entities/membership-plan.entity';
import { CreateMembershipSubscriptionDto } from 'src/membership/dto/create-membership-subscription.dto';
import { Repository } from 'typeorm';
import { Membership } from '../../entities/membership.entity';
import { BaseSubscriptionService } from './base-subscription.service';
import { PaymentConfigType } from 'src/common/enums/payment-config.enum';
import {
  MembershipAction,
  MembershipHistory,
} from 'src/membership/entities/membership-history.entity';

@Injectable()
export class VoucherSubscriptionService extends BaseSubscriptionService {
  protected readonly logger = new Logger(VoucherSubscriptionService.name);

  constructor(
    @InjectRepository(Membership)
    membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipHistory)
    membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(MembershipPlan)
    membershipPlanRepository: Repository<MembershipPlan>,
  ) {
    super(
      membershipRepository,
      membershipHistoryRepository,
      membershipPlanRepository,
    );
  }

  async processSubscription(
    userId: string,
    createDto: CreateMembershipSubscriptionDto,
    files: Array<{
      originalname: string;
      buffer: Buffer;
      mimetype: string;
      size: number;
    }>,
  ): Promise<any> {
    this.logger.log(`Procesando suscripción VOUCHER para usuario ${userId}`);

    try {
      // 1. VALIDAR MEMBRESÍA PENDIENTE
      await this.validatePendingMembership(userId);

      // 2. Obtener información del usuario
      const userInfo = await this.getUserInfo(userId);

      // 3. Calcular precios y determinar si es upgrade
      const {
        totalAmount,
        isUpgrade,
        currentMembership,
        previousMembershipState,
      } = await this.calculatePricingWithRollback(userId, createDto.planId);

      let newMembership: Membership;
      let membershipForRollback: number | null = null;

      // 4. Crear o actualizar membresía
      if (isUpgrade && currentMembership) {
        // Actualizar membresía existente
        const newPlan = await this.membershipPlanRepository.findOne({
          where: { id: createDto.planId },
        });
        if (!newPlan) {
          throw new Error('Plan no encontrado');
        }

        newMembership = await this.updateMembershipForUpgrade(
          currentMembership,
          newPlan,
        );
        membershipForRollback = newMembership.id;
      } else {
        // Crear nueva membresía
        newMembership = await this.createMembership(
          userId,
          userInfo,
          createDto.planId,
          new Date(),
        );
        membershipForRollback = newMembership.id;
      }

      // 5. Crear historial de membresía
      await this.createMembershipHistory(
        newMembership.id,
        isUpgrade ? MembershipAction.UPGRADE : MembershipAction.PURCHASE,
        isUpgrade
          ? `Upgrade de plan ${currentMembership?.plan.name} a ${newMembership.plan.name}`
          : `Compra de plan ${newMembership.plan.name}`,
      );

      // 6. Configurar pago
      const paymentConfig = isUpgrade
        ? PaymentConfigType.PLAN_UPGRADE
        : PaymentConfigType.MEMBERSHIP_PAYMENT;

      const metadata = isUpgrade
        ? {
            'Desde plan': currentMembership?.plan.name,
            'Hasta plan': newMembership.plan.name,
            'Monto original': newMembership.plan.price,
            'Monto con descuento': currentMembership?.plan.price,
          }
        : {
            Plan: newMembership.plan.name,
          };

      try {
        // 7. Crear pago
        const payment = await this.createPayment({
          userId,
          userEmail: userInfo.email,
          username: userInfo.fullName,
          paymentConfig,
          amount: totalAmount,
          status: 'PENDING',
          paymentMethod: PaymentMethod.VOUCHER,
          relatedEntityType: 'membership',
          relatedEntityId: newMembership.id,
          metadata,
          payments: createDto.payments,
          files,
        });

        this.logger.log(
          `Suscripción VOUCHER creada exitosamente para usuario ${userId}`,
        );

        return {
          success: true,
          message: 'Suscripción creada exitosamente',
          data: {
            membership: newMembership,
            payment,
            isUpgrade,
            totalAmount,
          },
        };
      } catch (paymentError) {
        // Rollback específico según el tipo de operación
        if (isUpgrade && previousMembershipState) {
          await this.rollbackUpgrade(
            membershipForRollback,
            previousMembershipState,
          );
        } else {
          await this.rollbackMembership(membershipForRollback);
        }
        throw paymentError;
      }
    } catch (error) {
      this.logger.error(
        `Error al procesar suscripción VOUCHER: ${error.message}`,
      );
      throw error;
    }
  }
}
