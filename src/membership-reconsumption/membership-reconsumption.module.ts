import { Module } from '@nestjs/common';
import { MembershipReconsumptionService } from './membership-reconsumption.service';
import { MembershipReconsumptionController } from './membership-reconsumption.controller';
import { MembershipReconsumption } from './entities/membership-reconsumption.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([MembershipReconsumption])],
  controllers: [MembershipReconsumptionController],
  providers: [MembershipReconsumptionService],
})
export class MembershipReconsumptionModule {}
