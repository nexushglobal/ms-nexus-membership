import { Controller } from '@nestjs/common';
import { MembershipService } from './membership.service';

@Controller()
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}
}
