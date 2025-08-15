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
      status: membership.status,
      startDate: membership.startDate,
      endDate: membership.endDate,
      paidAmount: membership.plan.price,
      plan: {
        name: membership.plan.name,
        price: membership.plan.price,
        directCommissionAmount: membership.plan.directCommissionAmount,
        commissionPercentage: membership.plan.commissionPercentage,
      },
    },
    lastReconsumption: lastReconsumption
      ? {
          amount: lastReconsumption.amount,
          periodDate: lastReconsumption.periodDate,
          createdAt: lastReconsumption.createdAt,
        }
      : null,
    pendingReconsumption: pendingReconsumption
      ? {
          amount: pendingReconsumption.amount,
          periodDate: pendingReconsumption.periodDate,
          createdAt: pendingReconsumption.createdAt,
        }
      : null,
    canReconsume,
  };
};
