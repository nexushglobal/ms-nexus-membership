import { Controller } from '@nestjs/common';
import { MembershipReconsumptionService } from './membership-reconsumption.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FindByMembershipIdDto } from './dto/find-by-membership-id.dto';

@Controller('membership-reconsumption')
export class MembershipReconsumptionController {
  constructor(
    private readonly membershipReconsumptionService: MembershipReconsumptionService,
  ) {}

  @MessagePattern({ cmd: 'membershipReconsumption.findByMembershipId' })
  getReconsumptions(@Payload() data: FindByMembershipIdDto) {
    return this.membershipReconsumptionService.findByMembershipId(data);
  }
}
