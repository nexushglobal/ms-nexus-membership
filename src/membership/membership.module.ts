import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipHistory } from './entities/membership-history.entity';
import { Membership } from './entities/membership.entity';
import { MembershipController } from './membership.controller';
import { MembershipService } from './membership.service';

@Module({
  imports: [TypeOrmModule.forFeature([MembershipHistory, Membership])],
  controllers: [MembershipController],
  providers: [MembershipService],
  exports: [TypeOrmModule, MembershipService],
})
export class MembershipModule {}
