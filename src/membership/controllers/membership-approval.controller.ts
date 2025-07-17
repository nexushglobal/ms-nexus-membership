import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MembershipApprovalService } from '../services/membership-approval.service';
import {
  RejectMembershipDto,
  RejectPlanUpgradeDto,
} from '../dto/reject-membership.dto';

@Controller()
export class MembershipApprovalController {
  private readonly logger = new Logger(MembershipApprovalController.name);

  constructor(
    private readonly membershipApprovalService: MembershipApprovalService,
  ) {}

  @MessagePattern({ cmd: 'membership.approveMembership' })
  async approveMembership(
    @Payload()
    data: {
      membershipId: number;
      paymentId: number;
      amount: number;
      approvedAt: Date;
    },
  ) {
    this.logger.log(`Aprobando membresía ID: ${data.membershipId}`);

    return await this.membershipApprovalService.approveMembership(data);
  }

  @MessagePattern({ cmd: 'membership.approvePlanUpgrade' })
  async approvePlanUpgrade(
    @Payload()
    data: {
      membershipId: number;
      paymentId: number;
      upgradeAmount: number;
      approvedAt: Date;
    },
  ) {
    this.logger.log(
      `Aprobando upgrade de plan para membresía ID: ${data.membershipId}`,
    );

    return await this.membershipApprovalService.approvePlanUpgrade(data);
  }

  @MessagePattern({ cmd: 'membership.rejectMembership' })
  async rejectMembership(@Payload() data: RejectMembershipDto) {
    this.logger.log(`Rechazando membresía ID: ${data.membershipId}`);
    return await this.membershipApprovalService.rejectMembership(data);
  }

  @MessagePattern({ cmd: 'membership.rejectPlanUpgrade' })
  async rejectPlanUpgrade(@Payload() data: RejectPlanUpgradeDto) {
    this.logger.log(
      `Rechazando upgrade de plan para membresía ID: ${data.membershipId}`,
    );
    return await this.membershipApprovalService.rejectPlanUpgrade(data);
  }
}
