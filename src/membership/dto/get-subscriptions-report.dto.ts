import { IsDateString, IsOptional } from 'class-validator';

export class GetSubscriptionsReportDto {
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de inicio debe estar en formato ISO 8601' },
  )
  startDate?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'La fecha de fin debe estar en formato ISO 8601' },
  )
  endDate?: string;
}

export interface MembershipSubscriptionData {
  id: number;
  planName: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  created: Date;
}
