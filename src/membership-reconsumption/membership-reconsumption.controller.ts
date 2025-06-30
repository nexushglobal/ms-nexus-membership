import { Controller } from '@nestjs/common';
import { MembershipReconsumptionService } from './membership-reconsumption.service';

@Controller('membership-reconsumption')
export class MembershipReconsumptionController {
  constructor(private readonly membershipReconsumptionService: MembershipReconsumptionService) {}
}
