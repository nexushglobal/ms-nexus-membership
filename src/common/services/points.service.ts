import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

export interface UserPointsResponse {
  availablePoints: number;
  totalEarnedPoints: number;
  totalWithdrawnPoints: number;
}

@Injectable()
export class PointsService {
  constructor(@Inject('NATS_SERVICE') private readonly client: ClientProxy) {}

  async getUserPoints(userId: string): Promise<UserPointsResponse> {
    return await firstValueFrom(
      this.client.send({ cmd: 'userPoints.get' }, { userId }),
    );
  }

  async createWeeklyVolume(data: {
    amount: number;
    volume: number;
    users: Array<{
      userId: string;
      userName: string;
      userEmail: string;
      site: 'LEFT' | 'RIGHT';
      paymentId?: string;
    }>;
  }): Promise<void> {
    return await firstValueFrom(
      this.client.send({ cmd: 'weeklyVolume.createVolume' }, data),
    );
  }

  async createMonthlyVolume(data: {
    amount: number;
    volume: number;
    users: Array<{
      userId: string;
      userName: string;
      userEmail: string;
      site: 'LEFT' | 'RIGHT';
      paymentId?: string;
      leftDirects?: number;
      rightDirects?: number;
    }>;
  }): Promise<void> {
    return await firstValueFrom(
      this.client.send({ cmd: 'monthlyVolume.createMonthlyVolume' }, data),
    );
  }

  async deductPointsForReconsumption(data: {
    userId: string;
    amount: number;
    reconsumptionId: number;
    reason: string;
  }): Promise<void> {
    return await firstValueFrom(
      this.client.send({ cmd: 'userPoints.deductForReconsumption' }, data),
    );
  }

  async addPointLotPoints(data: {
    userId: string;
    userName: string;
    userEmail: string;
    points: number;
    reference?: string;
  }): Promise<void> {
    return await firstValueFrom(
      this.client.send({ cmd: 'pointsLotTransaction.createLotPoints' }, data),
    );
  }

  async processWeeklyVolumes(): Promise<{
    processed: number;
    successful: number;
    failed: number;
    totalPoints: number;
  }> {
    return await firstValueFrom(
      this.client.send({ cmd: 'weeklyVolume.processWeeklyVolumes' }, {}),
    );
  }
}
