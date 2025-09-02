import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

export interface UserPeriodOrderDto {
  userId: string;
  startDate: string;
  endDate: string;
}

export interface UserOrderSummaryDto {
  userId: string;
  totalAmount: number;
  orderCount: number;
  meetsMinimumAmount: boolean;
}

export interface FindUserOrdersByPeriodResponseDto {
  usersOrdersSummary: UserOrderSummaryDto[];
  totalUsersProcessed: number;
}

@Injectable()
export class OrdersService {
  constructor(@Inject('NATS_SERVICE') private readonly client: ClientProxy) {}

  async findUserOrdersByPeriod(
    users: UserPeriodOrderDto[],
  ): Promise<FindUserOrdersByPeriodResponseDto> {
    return await firstValueFrom(
      this.client.send({ cmd: 'orders.findUserOrdersByPeriod' }, { users }),
    );
  }
}
