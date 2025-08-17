import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  RpcException,
  Transport,
} from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { PaymentConfigType } from 'src/common/enums/payment-config.enum';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { envs } from 'src/config/envs';
import { Membership } from 'src/membership/entities/membership.entity';
import { Repository } from 'typeorm';
import { CreateReconsumptionDto } from '../dto/create-membership-reconsumtion.dto';
import {
  MembershipReconsumption,
  ReconsumptionStatus,
} from '../entities/membership-reconsumption.entity';

@Injectable()
export abstract class BaseReconsumptionService {
  protected readonly logger = new Logger(BaseReconsumptionService.name);
  protected readonly usersClient: ClientProxy;
  protected readonly paymentsClient: ClientProxy;

  constructor(
    @InjectRepository(MembershipReconsumption)
    protected readonly reconsumptionRepository: Repository<MembershipReconsumption>,
    @InjectRepository(Membership)
    protected readonly membershipRepository: Repository<Membership>,
  ) {
    this.usersClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: { servers: [envs.NATS_SERVERS] },
    });

    this.paymentsClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: { servers: [envs.NATS_SERVERS] },
    });
  }

  abstract processReconsumption(
    userId: string,
    createDto: CreateReconsumptionDto,
    files?: Array<{ originalname: string; buffer: Buffer }>,
  ): Promise<any>;

  /**
   * Obtiene información del usuario desde el microservicio de usuarios
   */
  protected async getUserInfo(userId: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    phone?: string;
    documentNumber?: string;
  }> {
    try {
      const userInfo = await firstValueFrom(
        this.usersClient.send(
          { cmd: 'user.getUserDetailedInfo' },
          { userId: userId },
        ),
      );

      if (!userInfo) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Usuario no encontrado',
        });
      }

      return userInfo;
    } catch (error) {
      this.logger.error(
        `Error al obtener información del usuario: ${error.message}`,
      );
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al obtener información del usuario',
      });
    }
  }

  /**
   * Obtiene la membresía activa del usuario
   */
  protected async getUserMembership(userId: string): Promise<Membership> {
    const membership = await this.membershipRepository.findOne({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    if (!membership) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: 'Usuario no tiene una membresía',
      });
    }

    return membership;
  }

  /**
   * Crea un registro de reconsumo con estado PENDING
   */
  protected async createReconsumptionRecord(
    membership: Membership,
    amount: number,
    paymentDetails?: Record<string, any>,
  ): Promise<MembershipReconsumption> {
    const reconsumption = this.reconsumptionRepository.create({
      membership,
      amount,
      status: ReconsumptionStatus.PENDING,
      periodDate: new Date(),
      paymentDetails,
    });

    return await this.reconsumptionRepository.save(reconsumption);
  }

  /**
   * Crea el pago en el microservicio de payments
   */
  protected async createPayment(data: {
    userId: string;
    userEmail: string;
    username: string;
    amount: number;
    paymentMethod: PaymentMethod;
    relatedEntityType: string;
    relatedEntityId: number;
    metadata: any;
    payments?: any[];
    files?: Array<{
      originalname: string;
      buffer: Buffer;
      mimetype: string;
      size: number;
    }>;
    source_id?: string;
  }): Promise<any> {
    try {
      const paymentData = {
        userId: data.userId,
        userEmail: data.userEmail,
        username: data.username,
        paymentConfig: PaymentConfigType.RECONSUMPTION,
        amount: data.amount,
        status: 'PENDING',
        paymentMethod: data.paymentMethod,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
        metadata: data.metadata,
        payments: data.payments || [],
        files: data.files || [],
        source_id: data.source_id,
      };

      const payment = await firstValueFrom(
        this.paymentsClient.send({ cmd: 'payment.createPayment' }, paymentData),
      );

      return payment;
    } catch (error) {
      this.logger.error(`Error al crear el pago: ${error.message}`);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al crear el pago',
      });
    }
  }

  /**
   * Actualiza el reconsumo con la referencia del pago
   */
  protected async updateReconsumptionWithPayment(
    reconsumptionId: number,
    paymentReference: string,
  ): Promise<void> {
    await this.reconsumptionRepository.update(reconsumptionId, {
      paymentReference,
    });
  }

  /**
   * Elimina el reconsumo en caso de error (rollback)
   */
  protected async rollbackReconsumption(
    reconsumptionId: number,
  ): Promise<void> {
    try {
      await this.reconsumptionRepository.delete(reconsumptionId);
      this.logger.log(`Rollback: Reconsumo ${reconsumptionId} eliminado`);
    } catch (error) {
      this.logger.error(
        `Error en rollback del reconsumo ${reconsumptionId}: ${error.message}`,
      );
    }
  }
}
