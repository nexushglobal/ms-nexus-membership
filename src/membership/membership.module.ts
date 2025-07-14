import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipHistory } from './entities/membership-history.entity';
import { Membership } from './entities/membership.entity';
import { MembershipController } from './membership.controller';
import { MembershipReconsumptionModule } from '../membership-reconsumption/membership-reconsumption.module';
import { MembershipService } from './services/membership.service';
import { MembershipHistoryService } from './services/membership-history.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MembershipHistory, Membership]),
    MembershipReconsumptionModule,
  ],
  controllers: [MembershipController],
  providers: [MembershipService, MembershipHistoryService],
  exports: [TypeOrmModule, MembershipService],
})
export class MembershipModule {}
