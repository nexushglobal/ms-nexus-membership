/* eslint-disable @typescript-eslint/no-unused-vars */
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { PaymentService } from 'src/common/services/payment.service';
import { Membership } from 'src/membership/entities/membership.entity';
import { Repository } from 'typeorm';
import { CreateReconsumptionDto } from '../dto/create-membership-reconsumtion.dto';
import { MembershipReconsumption } from '../entities/membership-reconsumption.entity';
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
  ) {
    super(reconsumptionRepository, membershipRepository);
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
  ): Promise<{
    success: boolean;
    reconsumptionId: number;
    paymentId: string;
    pointsTransactionId: string;
    message: string;
    remainingPoints: number;
    amount: number;
  }> {
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

      // 3. Crear el registro de reconsumo
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

      const paymentResult =
        await this.paymentService.processPayment(paymentData);

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
        paymentResult.paymentId,
      );

      this.logger.log(
        `Reconsumo POINTS procesado exitosamente para usuario ${userId}. Payment ID: ${paymentResult.paymentId}`,
      );

      return {
        success: true,
        reconsumptionId: reconsumption.id,
        paymentId: paymentResult.paymentId,
        pointsTransactionId: paymentResult.pointsTransactionId,
        message: 'Reconsumo procesado exitosamente con puntos',
        remainingPoints: paymentResult.remainingPoints,
        amount: createDto.amount,
      };
    } catch (error) {
      this.logger.error(
        `Error al procesar reconsumo POINTS para usuario ${userId}: ${error.message}`,
      );

      // Rollback en caso de error
      if (reconsumption) {
        await this.rollbackReconsumption(reconsumption.id);
      }

      throw error;
    }
  }
}
