import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipPlan } from '../membership/entities/membership-plan.entity';
import { MembershipPlanMigrationController } from './controllers/membership-plan-migration.controller';
import { MembershipPlanMigrationService } from './services/membership-plan-migration.service';

@Module({
  imports: [TypeOrmModule.forFeature([MembershipPlan])],
  controllers: [MembershipPlanMigrationController],
  providers: [MembershipPlanMigrationService],
  exports: [MembershipPlanMigrationService],
})
export class MigrationModule {}
