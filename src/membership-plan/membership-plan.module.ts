import { Module } from '@nestjs/common';
import { MembershipPlanService } from './membership-plan.service';
import { MembershipPlanController } from './membership-plan.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipPlan } from './entities/membership-plan.entity';
import { MembershipModule } from 'src/membership/membership.module';

@Module({
  imports: [TypeOrmModule.forFeature([MembershipPlan]), MembershipModule],
  controllers: [MembershipPlanController],
  providers: [MembershipPlanService],
  exports: [MembershipPlanService],
})
export class MembershipPlanModule {}
