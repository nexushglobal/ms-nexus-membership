import { Controller } from '@nestjs/common';
import { MembershipService } from './services/membership.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FindByMembershipIdDto } from 'src/membership-reconsumption/dto/find-by-membership-id.dto';
import { MembershipHistoryService } from './services/membership-history.service';

@Controller()
export class MembershipController {
  constructor(
    private readonly membershipService: MembershipService,
    private readonly membershipHistoryService: MembershipHistoryService,
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
}
