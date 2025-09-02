import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

export interface GetUserResponse {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  photo?: string;
  nickname?: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject('NATS_SERVICE') private readonly client: ClientProxy) {}

  async getUser(userId: string): Promise<GetUserResponse> {
    return await firstValueFrom(
      this.client.send({ cmd: 'user.getUserBasicInfo' }, { userId }),
    );
  }

  async getUserAncestors(userId: string): Promise<
    {
      userId: string;
      userName: string;
      userEmail: string;
      site: 'LEFT' | 'RIGHT';
    }[]
  > {
    return await firstValueFrom(
      this.client.send({ cmd: 'user.tree.getAncestors' }, { userId }),
    );
  }
}
