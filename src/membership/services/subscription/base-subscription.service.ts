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
import { calculateMembershipDates } from 'src/common/utils/date.utils';
import { envs } from 'src/config/envs';
import { MembershipPlan } from 'src/membership-plan/entities/membership-plan.entity';
import { CreateMembershipSubscriptionDto } from 'src/membership/dto/create-membership-subscription.dto';
import { Repository } from 'typeorm';
import {
  MembershipAction,
  MembershipHistory,
} from '../../entities/membership-history.entity';
import { Membership, MembershipStatus } from '../../entities/membership.entity';

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
  protected async calculatePricingWithRollback(
    userId: string,
    newPlanId: number,
  ): Promise<{
    totalAmount: number;
    isUpgrade: boolean;
    currentMembership?: Membership;
    previousMembershipState?: Membership;
    previousPlan?: MembershipPlan | null;
  }> {
    // Buscar membresía actual del usuario
    const currentMembership = await this.membershipRepository.findOne({
      where: { userId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    // Obtener información del nuevo plan
    let previousPlan: MembershipPlan | null = null;
    if (currentMembership?.fromPlan && currentMembership.fromPlanId) {
      previousPlan = await this.membershipPlanRepository.findOne({
        where: { id: currentMembership.fromPlanId },
      });
    }

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
    if (currentMembership.status === MembershipStatus.PENDING) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: `Ya tienes una membresía pendiente. No puedes crear otra hasta que se procese la actual.`,
      });
    }
    if (currentMembership.status === MembershipStatus.DELETED) {
      return {
        totalAmount: newPlan.price,
        isUpgrade: false,
      };
    }

    const currentPrice = currentMembership.plan.price;
    const newPrice = newPlan.price;

    this.logger.log(
      `Comparando precios - Actual: ${currentPrice} (Plan ID: ${currentMembership.plan.id}), Nuevo: ${newPrice} (Plan ID: ${newPlan.id})`,
    );

    if (newPrice < currentPrice) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: `No puedes cambiar a un plan de menor valor. Plan actual: $${currentPrice}, Plan solicitado: $${newPrice}`,
      });
    }

    if (newPrice === currentPrice) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Ya tienes este plan de membresía',
      });
    }

    // Guardar estado anterior para rollback
    const previousMembershipState: Membership | undefined = currentMembership;

    // Es upgrade: calcular diferencia
    const totalAmount = newPrice - currentPrice;

    return {
      totalAmount,
      isUpgrade: true,
      currentMembership,
      previousMembershipState,
      previousPlan,
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
    status?: MembershipStatus,
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
    // buscar si tiene membresia
    const existingMembership = await this.membershipRepository.findOne({
      where: { userId },
    });
    const { startDate: membershipStart, endDate: membershipEnd } =
      calculateMembershipDates(startDate);

    if (existingMembership) {
      existingMembership.plan = plan;
      existingMembership.status = MembershipStatus.PENDING;
      existingMembership.startDate = membershipStart;
      existingMembership.endDate = membershipEnd;
      existingMembership.userEmail = userInfo.email;
      existingMembership.userName = userInfo.fullName;
      return await this.membershipRepository.save(existingMembership);
    }

    const membership = this.membershipRepository.create({
      userId,
      userEmail: userInfo.email,
      userName: userInfo.fullName,
      plan,
      startDate: membershipStart,
      endDate: membershipEnd,
      status: status ? status : MembershipStatus.PENDING,
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
    notes?: string,
  ): Promise<void> {
    const history = this.membershipHistoryRepository.create({
      membership: {
        id: membershipId,
      },
      action,
      metadata: {
        details,
      },
      notes,
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
    source_id?: string;
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

  protected async updateMembershipForUpgrade(
    currentMembership: Membership,
    newPlan: MembershipPlan,
    status?: MembershipStatus,
  ): Promise<Membership> {
    currentMembership.fromPlanId = currentMembership.plan.id;
    currentMembership.plan = newPlan;
    currentMembership.status = status ? status : MembershipStatus.PENDING;
    currentMembership.fromPlan = true;
    return await this.membershipRepository.save(currentMembership);
  }

  // 4. Método para rollback de upgrade
  protected async rollbackUpgrade(
    membershipId: number,
    previousState: Membership,
  ): Promise<void> {
    try {
      // Restaurar estado anterior
      await this.membershipRepository.update(membershipId, {
        plan: previousState.plan,
        status: previousState.status,
      });

      this.logger.warn(
        `Rollback de upgrade ejecutado para membresía ${membershipId}`,
      );
    } catch (error) {
      this.logger.error(`Error en rollback de upgrade: ${error.message}`);
    }
  }

  protected async validatePendingMembership(userId: string): Promise<void> {
    const pendingMembership = await this.membershipRepository.findOne({
      where: {
        userId,
        status: MembershipStatus.PENDING,
      },
      relations: ['plan'],
    });

    if (pendingMembership) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message:
          'Ya tienes una membresía pendiente. No puedes crear otra hasta que se procese la actual.',
      });
    }
  }
}
