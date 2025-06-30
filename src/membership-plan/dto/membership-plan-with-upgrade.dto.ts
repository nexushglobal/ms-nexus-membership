import { MembershipPlan } from '../entities/membership-plan.entity';

type MembershipPlanDto = Omit<
  MembershipPlan,
  'trimAndValidate' | 'memberships'
>;

export interface MembershipPlanWithUpgradeDto extends MembershipPlanDto {
  upgradeCost?: number;
  isUpgrade?: boolean;
}
