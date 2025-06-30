import { MembershipStatus } from '../entities/membership.entity';

export class UserMembershipInfoDto {
  hasMembership: boolean;
  membershipId?: number;
  status?: MembershipStatus;
  plan?: {
    id: number;
    name: string;
    price: number;
  };
  message?: string;
  endDate?: Date;
}
