import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipPlan } from '../membership/entities/membership-plan.entity';
import { Membership } from '../membership/entities/membership.entity';
import { MembershipReconsumption } from '../membership/entities/membership-reconsumption.entity';
import { MembershipHistory } from '../membership/entities/membership-history.entity';
import { MembershipPlanMigrationController } from './controllers/membership-plan-migration.controller';
import { MembershipMigrationController } from './controllers/membership-migration.controller';
import { MembershipPlanMigrationService } from './services/membership-plan-migration.service';
import { MembershipMigrationService } from './services/membership-migration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MembershipPlan,
      Membership,
      MembershipReconsumption,
      MembershipHistory,
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
