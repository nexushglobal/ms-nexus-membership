import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentConfigType } from 'src/common/enums/payment-config.enum';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { MembershipPlan } from 'src/membership-plan/entities/membership-plan.entity';
import { CreateMembershipSubscriptionDto } from 'src/membership/dto/create-membership-subscription.dto';
import { Repository } from 'typeorm';
import {
  MembershipAction,
  MembershipHistory,
} from '../../entities/membership-history.entity';
import { Membership } from '../../entities/membership.entity';
import { BaseSubscriptionService } from './base-subscription.service';

@Injectable()
export class PaymentGatewaySubscriptionService extends BaseSubscriptionService {
  protected readonly logger = new Logger(
    PaymentGatewaySubscriptionService.name,
  );

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
  ): Promise<any> {
    this.logger.log(
      `Procesando suscripción PAYMENT_GATEWAY para usuario ${userId}`,
    );

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
        previousPlan,
      } = await this.calculatePricingWithRollback(userId, createDto.planId);

      let newMembership: Membership;
      let membershipForRollback: number | null = null;

      // 4. Crear o actualizar membresía
      if (isUpgrade && currentMembership) {
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

      await this.createMembershipHistory(
        newMembership.id,
        isUpgrade ? MembershipAction.UPGRADE : MembershipAction.PURCHASE,
        isUpgrade
          ? `Upgrade de plan ${currentMembership?.plan.name} a ${newMembership.plan.name}`
          : `Compra de plan ${newMembership.plan.name}`,
        'Suscripción creada con metodo pasarela de pago',
      );

      // 6. Configurar pago
      const paymentConfig = isUpgrade
        ? PaymentConfigType.PLAN_UPGRADE
        : PaymentConfigType.MEMBERSHIP_PAYMENT;

      const metadata = isUpgrade
        ? {
            'Plan Anterior': previousPlan?.name,
            'Plan Nuevo': newMembership.plan.name,
            'Monto original': newMembership.plan.price,
            'Monto con descuento': totalAmount,
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
          paymentMethod: PaymentMethod.PAYMENT_GATEWAY,
          relatedEntityType: 'membership',
          relatedEntityId: newMembership.id,
          source_id: createDto.source_id,
          metadata,
        });

        this.logger.log(
          `Suscripción PAYMENT_GATEWAY creada exitosamente para usuario ${userId}`,
        );

        return {
          membership: newMembership,
          payment,
          isUpgrade,
          totalAmount,
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
