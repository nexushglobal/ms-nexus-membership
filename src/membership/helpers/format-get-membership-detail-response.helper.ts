import { MembershipReconsumption } from 'src/membership-reconsumption/entities/membership-reconsumption.entity';
import { GetMembershipDetailResponseDto } from '../dto/get-membership-detail.dto';
import { Membership } from '../entities/membership.entity';

export const formatGetMembershipDetailResponse = (
  membership: Membership,
  lastReconsumption: MembershipReconsumption | null,
  pendingReconsumption: MembershipReconsumption | null,
  canReconsume: boolean,
): GetMembershipDetailResponseDto => {
  return {
    membership: {
      id: membership.id,
      status: membership.status,
      startDate: membership.startDate,
      endDate: membership.endDate,
      autoRenewal: membership.autoRenewal,
      paidAmount: membership.plan.price,
      metadata: membership.metadata ? membership.metadata : {},
      plan: {
        id: membership.plan.id,
        name: membership.plan.name,
        price: membership.plan.price,
        binaryPoints: membership.plan.binaryPoints,
        checkAmount: membership.plan.checkAmount,
        commissionPercentage: membership.plan.commissionPercentage,
      },
    },
    lastReconsumption: lastReconsumption
      ? {
          id: lastReconsumption.id,
          amount: lastReconsumption.amount,
          status: lastReconsumption.status,
          periodDate: lastReconsumption.periodDate,
          createdAt: lastReconsumption.createdAt,
        }
      : null,
    pendingReconsumption: pendingReconsumption
      ? {
          id: pendingReconsumption.id,
          amount: pendingReconsumption.amount,
          status: pendingReconsumption.status,
          periodDate: pendingReconsumption.periodDate,
          createdAt: pendingReconsumption.createdAt,
        }
      : null,
    canReconsume,
  };
};
