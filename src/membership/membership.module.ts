import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipHistory } from './entities/membership-history.entity';
import { MembershipPlan } from './entities/membership-plan.entity';
import { MembershipReconsumption } from './entities/membership-reconsumption.entity';
import { Membership } from './entities/membership.entity';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MembershipHistory,
      MembershipPlan,
      MembershipReconsumption,
      Membership,
    ]),
  ],

  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [TypeOrmModule, MembershipService],
})
export class MembershipModule {}
