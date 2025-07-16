import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipPlan } from 'src/membership-plan/entities/membership-plan.entity';
import { MembershipReconsumptionModule } from 'src/membership-reconsumption/membership-reconsumption.module';
import { MembershipHistory } from './entities/membership-history.entity';
import { Membership } from './entities/membership.entity';
import { MembershipController } from './membership.controller';
import { MembershipSubscriptionService } from './services/membership-subscription.service';
import { MembershipService } from './services/membership.service';
import { PaymentGatewaySubscriptionService } from './services/subscription/payment-gateway-subscription.service';
import { PointsSubscriptionService } from './services/subscription/points-subscription.service';
import { VoucherSubscriptionService } from './services/subscription/voucher-subscription.service';
import { MembershipHistoryService } from './services/membership-history.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Membership, MembershipHistory, MembershipPlan]),
    forwardRef(() => MembershipReconsumptionModule), // ← Usar forwardRef aquí
  ],
  controllers: [MembershipController],
  providers: [
    MembershipService,
    MembershipHistoryService,
    MembershipSubscriptionService,
    VoucherSubscriptionService,
    PointsSubscriptionService,
    PaymentGatewaySubscriptionService,
  ],
  exports: [
    MembershipService,
    MembershipSubscriptionService,
    MembershipHistoryService,
    VoucherSubscriptionService,
    PointsSubscriptionService,
    PaymentGatewaySubscriptionService,
    TypeOrmModule,
  ],
})
export class MembershipModule {}
