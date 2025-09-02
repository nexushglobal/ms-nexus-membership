import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { MembershipHistory } from 'src/membership/entities/membership-history.entity';
import { Membership } from 'src/membership/entities/membership.entity';
import { MembershipModule } from 'src/membership/membership.module';
import { MembershipReconsumption } from './entities/membership-reconsumption.entity';
import { MembershipReconsumptionController } from './membership-reconsumption.controller';
import { MembershipReconsumptionService } from './membership-reconsumption.service';
import { MembershipReconsumptionApprovalService } from './services/membership-reconsumption-approval.service';
import { PaymentGatewayReconsumptionService } from './services/payment-gateway-reconsumption.service';
import { PointsReconsumptionService } from './services/points-reconsumption.service';
import { VoucherReconsumptionService } from './services/voucher-reconsumption.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MembershipReconsumption,
      Membership,
      MembershipHistory,
    ]),
    forwardRef(() => MembershipModule),
    CommonModule,
  ],
  controllers: [MembershipReconsumptionController],
  providers: [
    MembershipReconsumptionService,
    MembershipReconsumptionApprovalService,
    VoucherReconsumptionService,
    PointsReconsumptionService,
    PaymentGatewayReconsumptionService,
  ],
  exports: [
    MembershipReconsumptionService,
    TypeOrmModule,
    PointsReconsumptionService,
  ],
})
export class MembershipReconsumptionModule {}
