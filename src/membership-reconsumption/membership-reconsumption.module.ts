import { forwardRef, Module } from '@nestjs/common';
import { MembershipReconsumptionService } from './membership-reconsumption.service';
import { MembershipReconsumptionController } from './membership-reconsumption.controller';
import { MembershipReconsumption } from './entities/membership-reconsumption.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipModule } from 'src/membership/membership.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MembershipReconsumption]),
    forwardRef(() => MembershipModule),
  ],
  controllers: [MembershipReconsumptionController],
  providers: [MembershipReconsumptionService],
  exports: [MembershipReconsumptionService],
})
export class MembershipReconsumptionModule {}
