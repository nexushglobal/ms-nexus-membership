import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  RejectMembershipDto,
  RejectPlanUpgradeDto,
} from '../dto/reject-membership.dto';
import {
  MembershipAction,
  MembershipHistory,
} from '../entities/membership-history.entity';
import { Membership, MembershipStatus } from '../entities/membership.entity';

@Injectable()
export class MembershipApprovalService {
  private readonly logger = new Logger(MembershipApprovalService.name);

  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipHistory)
    private readonly membershipHistoryRepository: Repository<MembershipHistory>,
    private readonly dataSource: DataSource,
  ) {}

  async approveMembership(data: {
    membershipId: number;
    paymentId: number;
    amount: number;
    approvedAt: Date;
  }): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const membership = await this.membershipRepository.findOne({
        where: { id: data.membershipId },
        relations: ['plan'],
      });

      if (!membership) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Membresía no encontrada',
        });
      }

      membership.status = MembershipStatus.ACTIVE;
      await queryRunner.manager.save(Membership, membership);

      // 3. Crear entrada en el historial
      const historyEntry = this.membershipHistoryRepository.create({
        membership: membership,
        action: MembershipAction.PAYMENT_RECEIVED,
        notes: `Pago ID ${data.paymentId} aprobado exitosamente`,
        metadata: {
          'ID de Pago': data.paymentId,
          'Monto del Pago': data.amount,
          'Estado de la Membresía': 'APROBADA',
          'Plan de Membresía': membership.plan.name,
          'Fecha de Aprobación': data.approvedAt.toLocaleDateString('es-ES'),
          'Hora de Aprobación': data.approvedAt.toLocaleTimeString('es-ES'),
          Descripción: `Membresía aprobada exitosamente para el plan ${membership.plan.name}`,
        },
      });

      await queryRunner.manager.save(MembershipHistory, historyEntry);

      await queryRunner.commitTransaction();

      this.logger.log(`Membresía ${data.membershipId} aprobada exitosamente`);

      return {
        success: true,
        message: 'Membresía aprobada exitosamente',
        data: {
          membershipId: membership.id,
          status: membership.status,
          planName: membership.plan.name,
          paymentId: data.paymentId,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al aprobar membresía ${data.membershipId}: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async approvePlanUpgrade(data: {
    membershipId: number;
    paymentId: number;
    upgradeAmount: number;
    approvedAt: Date;
  }): Promise<any> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const membership = await this.membershipRepository.findOne({
        where: { id: data.membershipId },
        relations: ['plan'],
      });

      if (!membership) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Membresía no encontrada',
        });
      }

      const previousPlan = membership.plan;

      membership.status = MembershipStatus.ACTIVE;
      await queryRunner.manager.save(Membership, membership);

      const historyEntry = this.membershipHistoryRepository.create({
        membership: membership,
        action: MembershipAction.UPGRADE,
        notes: `Upgrade de plan aprobado con pago ID ${data.paymentId}`,
        metadata: {
          'ID de Pago': data.paymentId,
          'Monto del Upgrade': data.upgradeAmount,
          'Plan Anterior': previousPlan.name,
          'Plan Actual': membership.plan.name,
          'Estado de la Membresía': 'APROBADA',
          'Fecha de Aprobación': data.approvedAt.toLocaleDateString('es-ES'),
          'Hora de Aprobación': data.approvedAt.toLocaleTimeString('es-ES'),
          Descripción: `Upgrade exitoso de ${previousPlan.name} a ${membership.plan.name}`,
          'Costo del Upgrade': `$${data.upgradeAmount}`,
        },
      });

      await queryRunner.manager.save(MembershipHistory, historyEntry);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Upgrade de plan aprobado para membresía ${data.membershipId}`,
      );

      return {
        success: true,
        message: 'Upgrade de plan aprobado exitosamente',
        data: {
          membershipId: membership.id,
          status: membership.status,
          planName: membership.plan.name,
          previousPlan: previousPlan.name,
          paymentId: data.paymentId,
          upgradeAmount: data.upgradeAmount,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al aprobar upgrade de plan ${data.membershipId}: ${error.message}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rejectMembership(data: RejectMembershipDto) {
    try {
      const membership = await this.membershipRepository.findOne({
        where: { id: data.membershipId },
      });

      if (!membership) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Membership not found',
        });
      }

      membership.status = MembershipStatus.DELETED;

      await this.membershipRepository.save(membership);

      await this.createMembershipHistory(
        data.membershipId,
        MembershipAction.CANCELLED,
        `Membresía rechazada: ${data.reason}`,
      );

      this.logger.log(
        `Membresía ${data.membershipId} rechazada y marcada como DELETED`,
      );

      return {
        success: true,
        message: 'Membership rejected and deleted successfully',
        membershipId: data.membershipId,
      };
    } catch (error) {
      this.logger.error(`Error al rechazar membresía: ${error.message}`);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al rechazar membresía',
      });
    }
  }

  async rejectPlanUpgrade(data: RejectPlanUpgradeDto) {
    try {
      const membership = await this.membershipRepository.findOne({
        where: { id: data.membershipId },
        relations: ['plan'],
      });

      if (!membership) {
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Membership not found',
        });
      }

      const currentPlanId = membership.plan.id;

      // Revertir al plan anterior (fromPlanId)
      membership.plan = { id: data.fromPlanId } as any;
      membership.status = MembershipStatus.ACTIVE;

      await this.membershipRepository.save(membership);

      // Crear historial
      await this.createMembershipHistory(
        data.membershipId,
        MembershipAction.CANCELLED,
        `Upgrade rechazado, revertido del plan ${currentPlanId} al plan ${data.fromPlanId}: ${data.reason}`,
      );

      this.logger.log(
        `Plan upgrade rechazado para membresía ${data.membershipId}, revertido al plan ${data.fromPlanId}`,
      );

      return {
        success: true,
        message: 'Plan upgrade rejected, reverted to previous plan',
        membershipId: data.membershipId,
        revertedToPlanId: data.fromPlanId,
      };
    } catch (error) {
      this.logger.error(`Error al rechazar upgrade de plan: ${error.message}`);
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al rechazar upgrade de plan',
      });
    }
  }
  private async createMembershipHistory(
    membershipId: number,
    action: MembershipAction,
    details: string,
  ): Promise<void> {
    const history = this.membershipHistoryRepository.create({
      membership: { id: membershipId },
      action,
      metadata: { details },
    });

    await this.membershipHistoryRepository.save(history);
  }
}
