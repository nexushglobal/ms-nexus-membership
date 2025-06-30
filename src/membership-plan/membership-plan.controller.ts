import { Controller } from '@nestjs/common';
import { MembershipPlanService } from './membership-plan.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FindMembershipPlansDto } from './dto/find-membership-plan.dto';
import { FindOneMembershipPlanDto } from './dto/find-one-membership-plan.dto';

@Controller('membership-plan')
export class MembershipPlanController {
  constructor(private readonly membershipPlanService: MembershipPlanService) {}

  @MessagePattern({ cmd: 'membershipPlan.findAll' })
  async findAll(@Payload() findMembershipPlansDto: FindMembershipPlansDto) {
    return this.membershipPlanService.findAll(findMembershipPlansDto);
  }

  @MessagePattern({ cmd: 'membershipPlan.findOne' })
  async findOne(@Payload() findOneMembershipPlanDto: FindOneMembershipPlanDto) {
    return this.membershipPlanService.findOne(
      findOneMembershipPlanDto.id,
      findOneMembershipPlanDto.userId,
    );
  }
}
