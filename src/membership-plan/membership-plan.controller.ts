import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FindMembershipPlansDto } from './dto/find-membership-plan.dto';
import { FindOneMembershipPlanDto } from './dto/find-one-membership-plan.dto';
import { MembershipPlanService } from './membership-plan.service';

@Controller('membership-plan')
export class MembershipPlanController {
  constructor(private readonly membershipPlanService: MembershipPlanService) {}

  @MessagePattern({ cmd: 'membershipPlan.findAll' })
  async findAll(@Payload() findMembershipPlansDto: FindMembershipPlansDto) {
    return this.membershipPlanService.findAll(findMembershipPlansDto);
  }

  @MessagePattern({ cmd: 'membershipPlan.findOne' })
  async findOne(@Payload() findOneMembershipPlanDto: FindOneMembershipPlanDto) {
    console.log('findOneMembershipPlanDto', findOneMembershipPlanDto);
    return this.membershipPlanService.findOne(
      findOneMembershipPlanDto.id,
      findOneMembershipPlanDto.userId,
    );
  }
}
