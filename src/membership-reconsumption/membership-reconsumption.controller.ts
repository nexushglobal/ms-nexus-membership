import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CreateReconsumptionPayload } from './dto/create-membership-reconsumtion.dto';
import { FindByMembershipIdDto } from './dto/find-by-membership-id.dto';
import {
  ApproveReconsumptionDto,
  RejectReconsumptionDto,
} from './dto/reconsumption-approval.dto';
import { MembershipReconsumptionService } from './membership-reconsumption.service';
import { MembershipReconsumptionApprovalService } from './services/membership-reconsumption-approval.service';

@Controller('membership-reconsumption')
export class MembershipReconsumptionController {
  private readonly logger = new Logger(MembershipReconsumptionController.name);

  constructor(
    private readonly membershipReconsumptionService: MembershipReconsumptionService,
    private readonly membershipReconsumptionApprovalService: MembershipReconsumptionApprovalService,
  ) {}

  @MessagePattern({ cmd: 'membershipReconsumption.findByMembershipId' })
  getReconsumptions(@Payload() data: FindByMembershipIdDto) {
    return this.membershipReconsumptionService.findByMembershipId(data);
  }

  @MessagePattern({ cmd: 'membership.createReconsumption' })
  createReconsumption(@Payload() data: CreateReconsumptionPayload) {
    return this.membershipReconsumptionService.createReconsumption(data);
  }

  @MessagePattern({ cmd: 'membership.aproveReconsumption' })
  async approveReconsumption(@Payload() data: ApproveReconsumptionDto) {
    this.logger.log(`Aprobando reconsumo ID: ${data.reconsumptionId}`);
    return await this.membershipReconsumptionApprovalService.approveReconsumption(
      data,
    );
  }

  @MessagePattern({ cmd: 'membership.rejectReconsumption' })
  async rejectReconsumption(@Payload() data: RejectReconsumptionDto) {
    this.logger.log(`Rechazando reconsumo ID: ${data.reconsumptionId}`);
    return await this.membershipReconsumptionApprovalService.rejectReconsumption(
      data,
    );
  }
}
