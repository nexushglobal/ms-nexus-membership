import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { databaseConfig } from './config/database.config';
import { MembershipPlanModule } from './membership-plan/membership-plan.module';
import { MembershipReconsumptionModule } from './membership-reconsumption/membership-reconsumption.module';
import { MembershipModule } from './membership/membership.module';
import { SchedulesModule } from './schedules/schedules.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseConfig,
    }),
    MembershipModule,
    MembershipPlanModule,
    MembershipReconsumptionModule,
    SchedulesModule,
    CommonModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
