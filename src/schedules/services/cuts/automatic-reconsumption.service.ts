/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { OrdersService } from 'src/common/services/orders.service';
import { PaymentService } from 'src/common/services/payment.service';
import { PointsService } from 'src/common/services/points.service';
import { UsersService } from 'src/common/services/users.service';
import { MembershipReconsumptionService } from 'src/membership-reconsumption/membership-reconsumption.service';
import { PointsReconsumptionService } from 'src/membership-reconsumption/services/points-reconsumption.service';
import { MembershipService } from 'src/membership/services/membership.service';

export interface MembershipProcessResult {
  membershipId: number;
  userId: string;
  action: 'RENEWED' | 'FREE_RECONSUMPTION' | 'EXPIRED';
  amount?: number;
  pointsUsed?: number;
  success: boolean;
  error?: string;
}

export interface CutResult {
  successResults: MembershipProcessResult[];
  failedResults: MembershipProcessResult[];
  summary: {
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    executedAt: Date;
  };
}

@Injectable()
export class AutomaticReconsumptionService {
  private readonly logger = new Logger(AutomaticReconsumptionService.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly ordersService: OrdersService,
    private readonly pointsService: PointsService,
    private readonly usersService: UsersService,
    private readonly membershipService: MembershipService,
    private readonly membershipReconsumptionService: MembershipReconsumptionService,
    private readonly pointsReconsumptionService: PointsReconsumptionService,
  ) {}

  /**
   * Verifica si la membresía está en período de gracia (7 días después de endDate)
   */
  private isInGracePeriod(membership: any): boolean {
    const gracePeriodEndDate = new Date(membership.endDate);
    gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 7);

    const currentDate = new Date();
    return currentDate <= gracePeriodEndDate;
  }

  async execute(): Promise<CutResult> {
    this.logger.log('Iniciando proceso de corte automático de reconsumo');

    const successResults: MembershipProcessResult[] = [];
    const failedResults: MembershipProcessResult[] = [];
    const executedAt = new Date();

    try {
      const memberships = await this.membershipService.findExpiredMemberships(
        new Date().toISOString(),
      );
      this.logger.log(
        `Se encontraron ${memberships.length} membresías para procesar`,
      );

      for (const membership of memberships) {
        try {
          const result = await this.processReconsumptionForMembership(
            membership.id,
          );
          if (result) {
            successResults.push(result);
          }
        } catch (error) {
          const failedResult: MembershipProcessResult = {
            membershipId: membership.id,
            userId: membership.userId,
            action: 'EXPIRED',
            success: false,
            error: error.message || 'Error desconocido',
          };
          failedResults.push(failedResult);
          this.logger.error(
            `Error procesando membresía ${membership.id}: ${error.message}`,
          );
        }
      }

      const result: CutResult = {
        successResults,
        failedResults,
        summary: {
          totalProcessed: memberships.length,
          successCount: successResults.length,
          errorCount: failedResults.length,
          executedAt,
        },
      };

      this.logger.log(
        `Corte automático completado. Procesadas: ${successResults.length}, Errores: ${failedResults.length}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        'Error en el proceso de corte automático:',
        error.stack,
      );
      throw error;
    }
  }

  private async processReconsumptionForMembership(
    membershipId: number,
  ): Promise<MembershipProcessResult | null> {
    const membership = await this.membershipService.findOneById(membershipId);
    if (!membership) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Membresía ${membershipId} no encontrada`,
      });
    }

    const user = await this.usersService.getUser(membership.userId);
    if (!user) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: `Usuario ${membership.userId} no encontrado`,
      });
    }

    // Período de validación: 7 días después de startDate hasta 7 días después de endDate
    const validationStartDate = new Date(membership.startDate);
    validationStartDate.setDate(validationStartDate.getDate() + 7);
    const validationEndDate = new Date(membership.endDate);
    validationEndDate.setDate(validationEndDate.getDate() + 7);

    const ordersResult = await this.ordersService.findUserOrdersByPeriod([
      {
        userId: membership.userId,
        startDate: validationStartDate.toISOString().split('T')[0],
        endDate: validationEndDate.toISOString().split('T')[0],
      },
    ]);

    const userOrderSummary = ordersResult.usersOrdersSummary.find(
      (summary) => summary.userId === membership.userId,
    );

    const meetsMinimumAmount = userOrderSummary?.meetsMinimumAmount || false;

    if (!membership.isPointLot && meetsMinimumAmount) {
      await this.pointsReconsumptionService.processReconsumption(
        membership.userId,
        {
          paymentMethod: PaymentMethod.POINTS,
          membershipId: membership.id,
          amount: 300,
        },
        undefined,
        false,
      );

      return {
        membershipId: membership.id,
        userId: membership.userId,
        action: 'FREE_RECONSUMPTION',
        amount: 300,
        pointsUsed: 0,
        success: true,
      };
    } else if (membership.isPointLot || membership.autoRenewal) {
      const userPoints = await this.pointsService.getUserPoints(
        membership.userId,
      );
      const membershipPlan = this.membershipService.getMembershipPlan(
        membership.plan.id,
      );

      if (userPoints.availablePoints >= membershipPlan.pointsRequired) {
        await this.pointsReconsumptionService.processReconsumption(
          membership.userId,
          {
            paymentMethod: PaymentMethod.POINTS,
            membershipId: membership.id,
            amount: membershipPlan.pointsRequired,
          },
          undefined,
          true,
        );

        return {
          membershipId: membership.id,
          userId: membership.userId,
          action: 'RENEWED',
          amount: membershipPlan.pointsRequired,
          pointsUsed: membershipPlan.pointsRequired,
          success: true,
        };
      } else {
        // Verificar período de gracia antes de expirar
        if (this.isInGracePeriod(membership)) {
          // No hacer nada, dejar para el próximo corte
          return null;
        }

        await this.membershipService.expireMembership(membership.id);

        return {
          membershipId: membership.id,
          userId: membership.userId,
          action: 'EXPIRED',
          success: true,
        };
      }
    } else {
      // Verificar período de gracia antes de expirar
      if (this.isInGracePeriod(membership)) {
        // No hacer nada, dejar para el próximo corte
        return null;
      }

      await this.membershipService.expireMembership(membership.id);

      return {
        membershipId: membership.id,
        userId: membership.userId,
        action: 'EXPIRED',
        success: true,
      };
    }
  }
}
