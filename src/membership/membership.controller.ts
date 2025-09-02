import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FindByMembershipIdDto } from 'src/membership-reconsumption/dto/find-by-membership-id.dto';
import { CheckUserActiveMembershipDto } from './dto/check-user-active-membership.dto';
import { CreateSubscriptionPayload } from './dto/create-membership-subscription.dto';
import { FindExpiredMembershipsDto } from './dto/find-expired-memberships.dto';
import { GetSubscriptionsReportDto } from './dto/get-subscriptions-report.dto';
import { GetUserMembershipByUserIdDto } from './dto/get-user-membership-by-user-id.dto';
import { UpdateMembershipEndDateDto } from './dto/update-membership-end-date.dto';
import { UpdateMembershipStatusDto } from './dto/update-membership-status.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { MembershipHistoryService } from './services/membership-history.service';
import { MembershipSubscriptionService } from './services/membership-subscription.service';
import { MembershipService } from './services/membership.service';

@Controller()
export class MembershipController {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly membershipHistoryService: MembershipHistoryService,
    private readonly membershipSubscriptionService: MembershipSubscriptionService,
  ) {}

  @MessagePattern({ cmd: 'membership.getMembershipDetail' })
  getMembershipDetail(@Payload('userId') userId: string) {
    return this.membershipService.getMembershipDetail(userId);
  }

  @MessagePattern({ cmd: 'membershipHistory.findAllByMembershipId' })
  getMembershipHistory(@Payload() data: FindByMembershipIdDto) {
    return this.membershipHistoryService.findAllByMembershipId(data);
  }

  @MessagePattern({ cmd: 'membership.getUserMembershipInfo' })
  getUserMembershipInfo(@Payload('userId') userId: string) {
    return this.membershipService.getUserMembershipInfo(userId);
  }

  @MessagePattern({ cmd: 'membership.createSubscription' })
  createSubscription(@Payload() data: CreateSubscriptionPayload) {
    return this.membershipSubscriptionService.createSubscription(data);
  }

  @MessagePattern({ cmd: 'membership.getUserMembershipByUserId' })
  getUserMembershipByUserId(@Payload() data: GetUserMembershipByUserIdDto) {
    return this.membershipService.getUserMembershipByUserId(data.userId);
  }

  @MessagePattern({ cmd: 'membership.checkUserActiveMembership' })
  checkUserActiveMembership(@Payload() data: CheckUserActiveMembershipDto) {
    const userIds = data.users.map((user) => user.userId);
    return this.membershipService.checkUserActiveMembership(userIds);
  }

  @MessagePattern({ cmd: 'membership.updateMembership' })
  updateMembership(@Payload() data: UpdateMembershipDto) {
    return this.membershipService.updateMembership(data);
  }

  @MessagePattern({ cmd: 'membership.getUsersMembershipBatch' })
  getUsersMembershipBatch(@Payload() data: { userIds: string[] }) {
    return this.membershipService.getUsersMembershipBatch(data.userIds);
  }

  @MessagePattern({ cmd: 'membership.getSubscriptionsReport' })
  getSubscriptionsReport(@Payload() data: GetSubscriptionsReportDto) {
    return this.membershipService.getSubscriptionsReport(
      data.startDate,
      data.endDate,
    );
  }

  @MessagePattern({ cmd: 'membership.findExpiredMemberships' })
  findExpiredMemberships(@Payload() data: FindExpiredMembershipsDto) {
    return this.membershipService.findExpiredMemberships(data.currentDate);
  }

  @MessagePattern({ cmd: 'membership.updateEndDate' })
  updateMembershipEndDate(@Payload() data: UpdateMembershipEndDateDto) {
    return this.membershipService.updateMembershipEndDate(
      data.membershipId,
      data.endDate,
    );
  }

  @MessagePattern({ cmd: 'membership.updateStatus' })
  updateMembershipStatus(@Payload() data: UpdateMembershipStatusDto) {
    return this.membershipService.updateMembershipStatus(
      data.membershipId,
      data.status,
    );
  }
}
