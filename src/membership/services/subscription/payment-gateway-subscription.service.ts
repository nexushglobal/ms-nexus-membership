import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseSubscriptionService } from './base-subscription.service';
import { Membership } from '../../entities/membership.entity';
import { MembershipHistory } from '../../entities/membership-history.entity';
import { MembershipPlan } from 'src/membership-plan/entities/membership-plan.entity';
import { CreateMembershipSubscriptionDto } from 'src/membership/dto/create-membership-subscription.dto';

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
    files: Array<{ originalname: string; buffer: Buffer }>,
  ): Promise<any> {
    this.logger.log(
      `Procesando suscripción PAYMENT_GATEWAY para usuario ${userId}`,
    );

    // TODO: Implementar lógica para método PAYMENT_GATEWAY
    return {
      success: false,
      message: 'Método PAYMENT_GATEWAY no implementado aún',
    };
  }
}
