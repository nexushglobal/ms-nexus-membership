import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { MigrationModule } from './migration/migration.module';
import { MembershipModule } from './membership/membership.module';
import { MembershipPlanModule } from './membership-plan/membership-plan.module';
import { MembershipReconsumptionModule } from './membership-reconsumption/membership-reconsumption.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseConfig,
    }),
    MigrationModule,
    MembershipModule,
    MembershipPlanModule,
    MembershipReconsumptionModule,
    CommonModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
