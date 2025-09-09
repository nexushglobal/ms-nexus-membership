import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CommonModule } from 'src/common/common.module';
import { MembershipReconsumptionModule } from 'src/membership-reconsumption/membership-reconsumption.module';
import { MembershipModule } from 'src/membership/membership.module';
import { CutSchedulerService } from './services/cut-scheduler.service';
import { AutomaticReconsumptionService } from './services/cuts/automatic-reconsumption.service';
import { WeeklyVolumeProcessingService } from './services/cuts/weekly-volume-processing.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CommonModule,
    MembershipModule,
    MembershipReconsumptionModule,
  ],
  providers: [
    // Main scheduler service
    CutSchedulerService,

    // Cut services
    AutomaticReconsumptionService,
    WeeklyVolumeProcessingService,
  ],
  exports: [
    CutSchedulerService,
    AutomaticReconsumptionService,
    WeeklyVolumeProcessingService,
  ],
})
export class SchedulesModule {}
