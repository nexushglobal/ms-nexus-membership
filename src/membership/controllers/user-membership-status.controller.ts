import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GetUserMembershipStatusDto } from '../dto/get-user-membership-status.dto';
import { UserMembershipStatusService } from '../services/user-membership-status.service';

@Controller()
export class UserMembershipStatusController {
  constructor(
    private readonly userMembershipStatusService: UserMembershipStatusService,
  ) {}

  @MessagePattern({ cmd: 'membership.getUserMembershipStatus' })
  async getUserMembershipStatus(
    @Payload() payload: GetUserMembershipStatusDto,
  ) {
    return this.userMembershipStatusService.getUserMembershipStatus(
      payload.userId,
    );
  }
}
