/* eslint-disable @typescript-eslint/no-unused-vars */
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentConfigType } from 'src/common/enums/payment-config.enum';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { PaymentService } from 'src/common/services/payment.service';
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
export class PointsSubscriptionService extends BaseSubscriptionService {
  protected readonly logger = new Logger(PointsSubscriptionService.name);

  constructor(
    @InjectRepository(Membership)
    membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipHistory)
    membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(MembershipPlan)
    membershipPlanRepository: Repository<MembershipPlan>,
    private readonly paymentService: PaymentService,
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
    files: Array<{ originalname: string; buffer: Buffer }>,
  ): Promise<{
    success: boolean;
    membershipId: number;
    paymentId: string;
    pointsTransactionId: string;
    message: string;
    remainingPoints: number;
    totalAmount: number;
    isUpgrade: boolean;
  }> {
    this.logger.log(`Procesando suscripción POINTS para usuario ${userId}`);

    let newMembership: Membership | null = null;
    let previousMembershipState: Membership | undefined;
    let isUpgrade = false;

    try {
      // 1. Obtener información del usuario
      const userInfo = await this.getUserInfo(userId);

      // 2. Validar si tiene membresía pendiente
      await this.validatePendingMembership(userId);

      // 3. Calcular precios y determinar si es upgrade
      const {
        totalAmount,
        currentMembership,
        isUpgrade: upgradeFlag,
      } = await this.calculatePricingWithRollback(userId, createDto.planId);
      isUpgrade = upgradeFlag;

      // 4. Crear o actualizar membresía según corresponda
      if (isUpgrade && currentMembership) {
        // Guardar estado para rollback
        previousMembershipState = currentMembership;

        // Obtener el nuevo plan
        const newPlan = await this.membershipPlanRepository.findOne({
          where: { id: createDto.planId },
        });

        newMembership = await this.updateMembershipForUpgrade(
          currentMembership,
          newPlan!,
        );
      } else {
        // Crear nueva membresía
        newMembership = await this.createMembership(
          userId,
          userInfo,
          createDto.planId,
        );
      }

      // 5. Crear historial
      await this.createMembershipHistory(
        newMembership.id,
        isUpgrade ? MembershipAction.UPGRADE : MembershipAction.PURCHASE,
        isUpgrade
          ? `Upgrade de plan ${currentMembership?.plan.name} a ${newMembership.plan.name}`
          : `Compra de plan ${newMembership.plan.name}`,
      );

      // 6. Procesar pago con puntos
      const paymentConfig = isUpgrade
        ? PaymentConfigType.PLAN_UPGRADE
        : PaymentConfigType.MEMBERSHIP_PAYMENT;

      const paymentData = {
        userId,
        userEmail: userInfo.email,
        username: userInfo.fullName,
        paymentConfig,
        amount: totalAmount,
        paymentMethod: PaymentMethod.POINTS,
        relatedEntityType: 'membership',
        relatedEntityId: newMembership.id,
        metadata: {
          membershipId: newMembership.id,
          planId: createDto.planId,
          isUpgrade,
        },
      };

      const paymentResult =
        await this.paymentService.processPayment(paymentData);

      if (!paymentResult.success) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message:
            paymentResult.message || 'Error en el procesamiento del pago',
        });
      }

      this.logger.log(
        `Suscripción POINTS procesada exitosamente para usuario ${userId}. Payment ID: ${paymentResult.paymentId}`,
      );

      return {
        success: true,
        membershipId: newMembership.id,
        paymentId: paymentResult.paymentId,
        pointsTransactionId: paymentResult.pointsTransactionId,
        message: isUpgrade
          ? 'Upgrade de membresía procesado exitosamente con puntos'
          : 'Suscripción de membresía procesada exitosamente con puntos',
        remainingPoints: paymentResult.remainingPoints,
        totalAmount,
        isUpgrade,
      };
    } catch (error) {
      this.logger.error(
        `Error al procesar suscripción POINTS para usuario ${userId}: ${error.message}`,
      );

      // Rollback en caso de error
      if (newMembership) {
        if (isUpgrade && previousMembershipState) {
          await this.rollbackUpgrade(newMembership.id, previousMembershipState);
        } else {
          await this.rollbackMembership(newMembership.id);
        }
      }

      throw error;
    }
  }
}
