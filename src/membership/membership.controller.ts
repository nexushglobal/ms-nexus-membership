import { Controller } from '@nestjs/common';
import { MembershipService } from './services/membership.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FindByMembershipIdDto } from 'src/membership-reconsumption/dto/find-by-membership-id.dto';
import { MembershipHistoryService } from './services/membership-history.service';
import { MembershipSubscriptionService } from './services/membership-subscription.service';
import { CreateSubscriptionPayload } from './dto/create-membership-subscription.dto';

@Controller()
export class MembershipController {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly membershipHistoryService: MembershipHistoryService,
    private readonly membershipSubscriptionService: MembershipSubscriptionService,
  ) {}

  @MessagePattern({ cmd: 'membership.getMembershipDetail' })
  getMembershipDetail(@Payload('userId') userId: string) {
    console.log('getMembershipDetail', userId);
    return this.membershipService.getMembershipDetail(userId);
  }

  @MessagePattern({ cmd: 'membershipHistory.findAllByMembershipId' })
  getMembershipHistory(@Payload() data: FindByMembershipIdDto) {
    return this.membershipHistoryService.findAllByMembershipId(data);
  }

  @MessagePattern({ cmd: 'membership.createSubscription' })
  createSubscription(@Payload() data: CreateSubscriptionPayload) {
    return this.membershipSubscriptionService.createSubscription(data);
  }
}
