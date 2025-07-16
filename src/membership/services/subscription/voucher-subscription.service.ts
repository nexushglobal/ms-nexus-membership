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
    files: Array<{ originalname: string; buffer: Buffer }>,
  ): Promise<any> {
    this.logger.log(`Procesando suscripción VOUCHER para usuario ${userId}`);

    try {
      const { totalAmount, isUpgrade, currentMembership } =
        await this.evaluateMembershipAndAmount(userId, createDto.planId);

      const userInfo = await this.getUserInfo(userId);

      const newMembership = await this.createMembership(
        userId,
        userInfo,
        createDto.planId,
      );

      await this.createMembershipHistory(
        newMembership.id,
        isUpgrade ? MembershipAction.UPGRADE : MembershipAction.PURCHASE,
        isUpgrade
          ? `Upgrade de plan ${currentMembership?.plan.name} a ${newMembership.plan.name}`
          : `Compra de plan ${newMembership.plan.name}`,
      );

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
        await this.rollbackMembership(newMembership.id);
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
