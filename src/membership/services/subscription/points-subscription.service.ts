import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MembershipPlan } from 'src/membership-plan/entities/membership-plan.entity';
import { CreateMembershipSubscriptionDto } from 'src/membership/dto/create-membership-subscription.dto';
import { Repository } from 'typeorm';
import { MembershipHistory } from '../../entities/membership-history.entity';
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
    this.logger.log(`Procesando suscripción POINTS para usuario ${userId}`);

    // TODO: Implementar lógica para método POINTS
    return {
      success: false,
      message: 'Método POINTS no implementado aún',
    };
  }
}
