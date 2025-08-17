import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { calculateMembershipDates } from 'src/common/utils/date.utils';
import {
  MembershipAction,
  MembershipHistory,
} from 'src/membership/entities/membership-history.entity';
import {
  Membership,
  MembershipStatus,
} from 'src/membership/entities/membership.entity';
import { DataSource, Repository } from 'typeorm';
import {
  ApproveReconsumptionDto,
  ApproveReconsumptionResponseDto,
  RejectReconsumptionDto,
  RejectReconsumptionResponseDto,
} from '../dto/reconsumption-approval.dto';
import {
  MembershipReconsumption,
  ReconsumptionStatus,
} from '../entities/membership-reconsumption.entity';

@Injectable()
export class MembershipReconsumptionApprovalService {
  private readonly logger = new Logger(
    MembershipReconsumptionApprovalService.name,
  );

  constructor(
    @InjectRepository(MembershipReconsumption)
    private readonly reconsumptionRepository: Repository<MembershipReconsumption>,
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipHistory)
    private readonly membershipHistoryRepository: Repository<MembershipHistory>,
    private readonly dataSource: DataSource,
  ) {}

  async approveReconsumption(
    data: ApproveReconsumptionDto,
  ): Promise<ApproveReconsumptionResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validar que el reconsumo exista y esté en estado PENDING
      const reconsumption = await this.reconsumptionRepository.findOne({
        where: { id: data.reconsumptionId },
        relations: ['membership', 'membership.plan'],
      });

      if (!reconsumption) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Reconsumo no encontrado',
        });
      }

      if (reconsumption.status !== ReconsumptionStatus.PENDING) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: `El reconsumo debe estar en estado PENDING. Estado actual: ${reconsumption.status}`,
        });
      }

      // 2. Obtener la membresía asociada
      const membership = reconsumption.membership;

      // 3. Calcular las nuevas fechas de la membresía
      const { newStartDate, newEndDate } =
        this.calculateNewMembershipDates(membership);

      // 4. Actualizar el reconsumo a ACTIVE
      await queryRunner.manager.update(
        MembershipReconsumption,
        data.reconsumptionId,
        {
          status: ReconsumptionStatus.ACTIVE,
        },
      );

      // 5. Actualizar la membresía con las nuevas fechas
      await queryRunner.manager.update(Membership, membership.id, {
        startDate: newStartDate,
        endDate: newEndDate,
        status: MembershipStatus.ACTIVE,
      });

      // 6. Crear historial de la membresía
      const membershipHistory = this.membershipHistoryRepository.create({
        membership: { id: membership.id },
        action: MembershipAction.RECONSUMPTION_ADDED,
        notes: `Reconsumo aprobado por monto de ${data.amount}`,
        metadata: {
          reconsumptionId: data.reconsumptionId,
          paymentId: data.paymentId,
          amount: data.amount,
          approvedAt: data.approvedAt,
          previousStartDate: membership.startDate,
          previousEndDate: membership.endDate,
          newStartDate,
          newEndDate,
        },
      });

      await queryRunner.manager.save(membershipHistory);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Reconsumo ${data.reconsumptionId} aprobado exitosamente. Nuevas fechas: ${newStartDate.toISOString()} - ${newEndDate.toISOString()}`,
      );

      return {
        reconsumptionId: data.reconsumptionId,
        newStartDate,
        newEndDate,
        minReconsumptionAmount: membership.minimumReconsumptionAmount,
        isPointLot: membership.isPointLot,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al aprobar reconsumo ${data.reconsumptionId}: ${error.message}`,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno al aprobar el reconsumo',
      });
    } finally {
      await queryRunner.release();
    }
  }

  async rejectReconsumption(
    data: RejectReconsumptionDto,
  ): Promise<RejectReconsumptionResponseDto> {
    try {
      // 1. Validar que el reconsumo exista y esté en estado PENDING
      const reconsumption = await this.reconsumptionRepository.findOne({
        where: { id: data.reconsumptionId },
      });

      if (!reconsumption) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Reconsumo no encontrado',
        });
      }

      if (reconsumption.status !== ReconsumptionStatus.PENDING) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message: `El reconsumo debe estar en estado PENDING. Estado actual: ${reconsumption.status}`,
        });
      }

      // 2. Actualizar el reconsumo a CANCELLED
      await this.reconsumptionRepository.update(data.reconsumptionId, {
        status: ReconsumptionStatus.CANCELLED,
      });

      this.logger.log(
        `Reconsumo ${data.reconsumptionId} rechazado exitosamente`,
      );

      return {
        reconsumptionId: data.reconsumptionId,
        paymentId: data.paymentId,
        rejectedAt: data.rejectedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error al rechazar reconsumo ${data.reconsumptionId}: ${error.message}`,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno al rechazar el reconsumo',
      });
    }
  }

  /**
   * Calcula las nuevas fechas de la membresía según las reglas de negocio
   */
  private calculateNewMembershipDates(membership: Membership): {
    newStartDate: Date;
    newEndDate: Date;
  } {
    const currentDate = new Date();
    const membershipEndDate = new Date(membership.endDate);

    if (membership.status !== MembershipStatus.ACTIVE) {
      return this.createMembershipDatesFromCurrentDate(currentDate);
    }

    const daysSinceExpiration = this.calculateDaysDifference(
      currentDate,
      membershipEndDate,
    );
    const daysUntilExpiration = this.calculateDaysDifference(
      membershipEndDate,
      currentDate,
    );

    if (this.isMembershipExpired(daysSinceExpiration)) {
      return this.handleExpiredMembership(
        daysSinceExpiration,
        currentDate,
        membershipEndDate,
      );
    }

    return this.handleActiveMembership(
      daysUntilExpiration,
      currentDate,
      membershipEndDate,
    );
  }

  private calculateDaysDifference(fromDate: Date, toDate: Date): number {
    return Math.ceil(
      (fromDate.getTime() - toDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  private isMembershipExpired(daysSinceExpiration: number): boolean {
    return daysSinceExpiration >= 0;
  }

  private isWithinRenewalPeriod(days: number): boolean {
    return days <= 7;
  }

  private createMembershipDatesFromCurrentDate(currentDate: Date): {
    newStartDate: Date;
    newEndDate: Date;
  } {
    const newStartDate = new Date(currentDate);
    const newEndDate = calculateMembershipDates(newStartDate).endDate;
    return { newStartDate, newEndDate };
  }

  private createMembershipDatesFromEndDate(endDate: Date): {
    newStartDate: Date;
    newEndDate: Date;
  } {
    const newStartDate = new Date(endDate);
    const newEndDate = calculateMembershipDates(newStartDate).endDate;
    return { newStartDate, newEndDate };
  }

  private handleExpiredMembership(
    daysSinceExpiration: number,
    currentDate: Date,
    membershipEndDate: Date,
  ): { newStartDate: Date; newEndDate: Date } {
    if (this.isWithinRenewalPeriod(daysSinceExpiration)) {
      return this.createMembershipDatesFromEndDate(membershipEndDate);
    }
    return this.createMembershipDatesFromCurrentDate(currentDate);
  }

  private handleActiveMembership(
    daysUntilExpiration: number,
    currentDate: Date,
    membershipEndDate: Date,
  ): { newStartDate: Date; newEndDate: Date } {
    if (this.isWithinRenewalPeriod(daysUntilExpiration)) {
      return this.createMembershipDatesFromEndDate(membershipEndDate);
    }
    return this.createMembershipDatesFromCurrentDate(currentDate);
  }
}
