import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateManualSubscriptionDto,
  CreateManualSubscriptionResponseDto,
} from '../dto/manual-subscription.dto';
import { ManualSubscriptionService } from '../services/subscription/manual-subscription.service';

@Controller()
export class ManualSubscriptionController {
  private readonly logger = new Logger(ManualSubscriptionController.name);

  constructor(
    private readonly manualSubscriptionService: ManualSubscriptionService,
  ) {}

  @MessagePattern({ cmd: 'membership.createManualSubscription' })
  async createManualSubscription(
    @Payload() dto: CreateManualSubscriptionDto,
  ): Promise<CreateManualSubscriptionResponseDto> {
    return await this.manualSubscriptionService.processManualSubscription({
      userEmail: dto.userEmail,
      planId: dto.planId,
      reason: dto.reason,
    });
  }
}
