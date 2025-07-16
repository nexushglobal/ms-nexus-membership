import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
  RpcException,
} from '@nestjs/microservices';
import { HttpStatus } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { envs } from 'src/config/envs';
import { Membership, MembershipStatus } from '../../entities/membership.entity';
import {
  MembershipHistory,
  MembershipAction,
} from '../../entities/membership-history.entity';
import { MembershipPlan } from 'src/membership-plan/entities/membership-plan.entity';
import { calculateMembershipDates } from 'src/common/utils/date.utils';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { PaymentConfigType } from 'src/common/enums/payment-config.enum';
import { CreateMembershipSubscriptionDto } from 'src/membership/dto/create-membership-subscription.dto';

@Injectable()
export abstract class BaseSubscriptionService {
  protected readonly logger = new Logger(BaseSubscriptionService.name);
  protected readonly usersClient: ClientProxy;
  protected readonly paymentsClient: ClientProxy;

  constructor(
    @InjectRepository(Membership)
    protected readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipHistory)
    protected readonly membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(MembershipPlan)
    protected readonly membershipPlanRepository: Repository<MembershipPlan>,
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

  abstract processSubscription(
    userId: string,
    createDto: CreateMembershipSubscriptionDto,
    files: Array<{ originalname: string; buffer: Buffer }>,
  ): Promise<any>;

  /**
   * Evalúa si el usuario tiene membresía y calcula el monto total
   */
  protected async evaluateMembershipAndAmount(
    userId: string,
    newPlanId: number,
  ): Promise<{
    totalAmount: number;
    isUpgrade: boolean;
    currentMembership?: Membership;
  }> {
    // Buscar membresía actual del usuario
    const currentMembership = await this.membershipRepository.findOne({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    // Obtener información del nuevo plan
    const newPlan = await this.membershipPlanRepository.findOne({
      where: { id: newPlanId },
    });

    if (!newPlan) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: 'Plan de membresía no encontrado',
      });
    }

    // Si no tiene membresía actual, usar precio completo
    if (!currentMembership) {
      return {
        totalAmount: newPlan.price,
        isUpgrade: false,
      };
    }

    // Si tiene membresía, evaluar upgrade
    const currentPrice = currentMembership.plan.price;
    const newPrice = newPlan.price;

    if (newPrice < currentPrice) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'No puedes cambiar a un plan de menor valor',
      });
    }

    if (newPrice === currentPrice) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Ya tienes este plan de membresía',
      });
    }

    // Es upgrade: calcular diferencia
    const totalAmount = newPrice - currentPrice;

    return {
      totalAmount,
      isUpgrade: true,
      currentMembership,
    };
  }

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
   * Crea una nueva membresía con estado PENDING
   */
  protected async createMembership(
    userId: string,
    userInfo: any,
    planId: number,
    startDate?: Date,
  ): Promise<Membership> {
    const plan = await this.membershipPlanRepository.findOne({
      where: { id: planId },
    });

    if (!plan) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: 'Plan de membresía no encontrado',
      });
    }

    const { startDate: membershipStart, endDate: membershipEnd } =
      calculateMembershipDates(startDate);

    const membership = this.membershipRepository.create({
      userId,
      userEmail: userInfo.email,
      userName: userInfo.fullName,
      plan,
      startDate: membershipStart,
      endDate: membershipEnd,
      status: MembershipStatus.PENDING,
    });

    return await this.membershipRepository.save(membership);
  }

  /**
   * Crea el historial de membresía
   */
  protected async createMembershipHistory(
    membershipId: number,
    action: MembershipAction,
    details?: string,
  ): Promise<void> {
    const history = this.membershipHistoryRepository.create({
      membership: {
        id: membershipId,
      },
      action,
      metadata: {
        details,
      },
    });

    await this.membershipHistoryRepository.save(history);
  }

  /**
   * Crea el pago en el microservicio de payments
   */
  protected async createPayment(data: {
    userId: string;
    userEmail: string;
    username: string;
    paymentConfig: PaymentConfigType;
    amount: number;
    status: string;
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
  }): Promise<any> {
    try {
      const paymentData = {
        userId: data.userId,
        userEmail: data.userEmail,
        username: data.username,
        paymentConfig: data.paymentConfig,
        amount: data.amount,
        status: data.status,
        paymentMethod: data.paymentMethod,
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
        metadata: data.metadata,
        payments: data.payments || [],
        files: data.files || [],
      };
      this.logger.log(`files pago: ${JSON.stringify(data.files)}`);

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
   * Elimina registros en caso de error (rollback)
   */
  protected async rollbackMembership(membershipId: number): Promise<void> {
    try {
      // Eliminar historial
      await this.membershipHistoryRepository.delete({
        membership: { id: membershipId },
      });

      // Eliminar membresía
      await this.membershipRepository.delete({ id: membershipId });

      this.logger.warn(`Rollback ejecutado para membresía ${membershipId}`);
    } catch (error) {
      this.logger.error(`Error en rollback: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    await this.usersClient.close();
    await this.paymentsClient.close();
  }
}
