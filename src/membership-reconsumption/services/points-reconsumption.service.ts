import {
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { PaymentService } from 'src/common/services/payment.service';
import { PointsService } from 'src/common/services/points.service';
import { UsersService } from 'src/common/services/users.service';
import { Membership } from 'src/membership/entities/membership.entity';
import { MembershipService } from 'src/membership/services/membership.service';
import { Repository } from 'typeorm';
import { CreateReconsumptionDto } from '../dto/create-membership-reconsumtion.dto';
import { MembershipReconsumption } from '../entities/membership-reconsumption.entity';
import { ReconsumptionResponse } from '../interfaces/reconsumption-response.interface';
import { BaseReconsumptionService } from './base-reconsumption.service';

@Injectable()
export class PointsReconsumptionService extends BaseReconsumptionService {
  protected readonly logger = new Logger(PointsReconsumptionService.name);

  constructor(
    @InjectRepository(MembershipReconsumption)
    reconsumptionRepository: Repository<MembershipReconsumption>,
    @InjectRepository(Membership)
    membershipRepository: Repository<Membership>,
    private readonly paymentService: PaymentService,
    @Inject(forwardRef(() => MembershipService))
    private readonly membershipService: MembershipService,
    pointsService: PointsService,
    usersService: UsersService,
  ) {
    super(
      reconsumptionRepository,
      membershipRepository,
      pointsService,
      usersService,
    );
  }

  async processReconsumption(
    userId: string,
    createDto: CreateReconsumptionDto,
    files?: Array<{
      originalname: string;
      buffer: Buffer;
      mimetype: string;
      size: number;
    }>,
    usePoints?: boolean,
  ): Promise<ReconsumptionResponse> {
    this.logger.log(`Procesando reconsumo con POINTS para usuario ${userId}`);

    let reconsumption: MembershipReconsumption | null = null;

    try {
      // 1. Obtener información del usuario
      const userInfo = await this.getUserInfo(userId);

      // 2. Validar y obtener la membresía del usuario
      const membership = await this.getUserMembership(
        userId,
        createDto.membershipId,
      );

      let paymentResult;
      if (usePoints) {
        // 3. Crear el registro de reconsumo con estado PENDING
        reconsumption = await this.createReconsumptionRecord(
          membership,
          createDto.amount,
          {
            paymentMethod: PaymentMethod.POINTS,
            planName: membership.plan.name,
          },
        );

        // 4. Procesar pago con puntos
        const paymentData = {
          userId,
          userEmail: userInfo.email,
          username: userInfo.fullName,
          paymentConfig: 'RECONSUMPTION' as any,
          amount: createDto.amount,
          paymentMethod: PaymentMethod.POINTS,
          relatedEntityType: 'membership_reconsumption',
          relatedEntityId: reconsumption.id,
          metadata: {
            reconsumptionId: reconsumption.id,
            membershipId: membership.id,
            planId: membership.plan.id,
            planName: membership.plan.name,
          },
        };

        paymentResult = await this.paymentService.processPayment(paymentData);

        if (!paymentResult.success) {
          throw new RpcException({
            status: HttpStatus.BAD_REQUEST,
            message:
              paymentResult.message || 'Error en el procesamiento del pago',
          });
        }

        // 5. Actualizar reconsumo con la referencia del pago
        await this.updateReconsumptionWithPayment(
          reconsumption.id,
          paymentResult.paymentId as string,
        );

        // 6. Procesar volumen mensual y semanal
        await this.processVolumeForReconsumption(
          userId,
          paymentResult.paymentId as string,
        );
      } else {
        // 3. Crear el registro de reconsumo con estado CONFIRMED para reconsumo por órdenes
        reconsumption = await this.createConfirmedReconsumptionRecord(
          membership,
          createDto.amount,
          {
            type: 'ORDER_BASED',
            totalOrderAmount: createDto.amount,
            processedAt: new Date().toISOString(),
          },
          'Reconsumo automático por órdenes entregadas',
        );

        // 4. Renovar la membresía (reactiva y extiende 30 días)
        await this.membershipService.renewMembership(membership.id);

        // 5. Procesar volumen mensual y semanal sin paymentId
        await this.processVolumeForReconsumption(userId);
      }

      this.logger.log(
        `Reconsumo POINTS procesado exitosamente para usuario ${userId}. Payment ID: ${paymentResult?.paymentId ?? 'N/A'}`,
      );

      return {
        reconsumption,
        paymentId: paymentResult?.paymentId ?? null,
        totalAmount: createDto.amount,
      };
    } catch (error) {
      this.logger.error(
        `Error al procesar reconsumo POINTS para usuario ${userId}: ${error.message}`,
      );
      // Rollback en caso de error
      if (reconsumption) await this.rollbackReconsumption(reconsumption.id);
      throw error;
    }
  }
}
