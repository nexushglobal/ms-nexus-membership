export class RejectMembershipDto {
  membershipId: number;
  paymentId: number;
  reason: string;
}

export class RejectPlanUpgradeDto {
  membershipId: number;
  paymentId: number;
  reason: string;
}
