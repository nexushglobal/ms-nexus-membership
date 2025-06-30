import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from '../membership/entities/membership.entity';
import { MembershipHistory } from '../membership/entities/membership-history.entity';
import { MembershipPlanMigrationController } from './controllers/membership-plan-migration.controller';
import { MembershipMigrationController } from './controllers/membership-migration.controller';
import { MembershipPlanMigrationService } from './services/membership-plan-migration.service';
import { MembershipMigrationService } from './services/membership-migration.service';
import { MembershipPlan } from 'src/membership-plan/entities/membership-plan.entity';
import { MembershipReconsumption } from 'src/membership-reconsumption/entities/membership-reconsumption.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Membership,
      MembershipHistory,
      MembershipPlan,
      MembershipReconsumption,
    ]),
  ],
  controllers: [
    MembershipPlanMigrationController,
    MembershipMigrationController,
  ],
  providers: [MembershipPlanMigrationService, MembershipMigrationService],
  exports: [MembershipPlanMigrationService, MembershipMigrationService],
})
export class MigrationModule {}
