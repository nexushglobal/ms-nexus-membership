import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { catchError, firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';

export interface UserContactInfo {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  fullName: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  private readonly userClient: ClientProxy;

  constructor() {
    this.userClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async getUsersContactInfo(userIds: string[]): Promise<UserContactInfo[]> {
    try {
      return await firstValueFrom(
        this.userClient
          .send<
            UserContactInfo[]
          >({ cmd: 'users.getUsersContactInfo' }, { userIds })
          .pipe(
            catchError((error) => {
              if (error instanceof RpcException) throw error;
              const err = error as {
                message?: string | string[];
                status?: number;
                service?: string;
              };

              // Determinamos el mensaje del error
              let errorMessage: string[];
              if (Array.isArray(err?.message)) {
                errorMessage = err.message;
              } else if (typeof err?.message === 'string') {
                errorMessage = [err.message];
              } else {
                errorMessage = ['Error al obtener información de usuarios'];
              }

              const statusCode =
                typeof err?.status === 'number'
                  ? err.status
                  : HttpStatus.INTERNAL_SERVER_ERROR;

              const service = err?.service || 'ms-nexus-user';

              throw new RpcException({
                status: statusCode,
                message: errorMessage,
                service,
              });
            }),
          ),
      );
    } catch (error) {
      this.logger.error('Error communicating with user service:', error);
      // En caso de error, retornar array vacío para no romper el reporte
      return [];
    }
  }
}
