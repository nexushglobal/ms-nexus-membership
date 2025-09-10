import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { MembershipPlan } from 'src/membership-plan/entities/membership-plan.entity';
import {
  CreateManualSubscriptionDto,
  CreateManualSubscriptionResponseDto,
} from 'src/membership/dto/manual-subscription.dto';
import { Repository } from 'typeorm';
import {
  MembershipAction,
  MembershipHistory,
} from '../../entities/membership-history.entity';
import { Membership, MembershipStatus } from '../../entities/membership.entity';
import { BaseSubscriptionService } from './base-subscription.service';

@Injectable()
export class ManualSubscriptionService extends BaseSubscriptionService {
  protected readonly logger = new Logger(ManualSubscriptionService.name);

  constructor(
    @InjectRepository(Membership)
    membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipHistory)
    membershipHistoryRepository: Repository<MembershipHistory>,
    @InjectRepository(MembershipPlan)
    membershipPlanRepository: Repository<MembershipPlan>,
  ) {
    super(
      membershipRepository,
      membershipHistoryRepository,
      membershipPlanRepository,
    );
  }

  /**
   * Procesa una suscripción manual sin crear payment
   */
  async processManualSubscription(
    dto: CreateManualSubscriptionDto,
  ): Promise<CreateManualSubscriptionResponseDto> {
    this.logger.log(`🔄 Procesando suscripción manual: ${JSON.stringify(dto)}`);

    try {
      // 1. Buscar usuario por email
      const userInfo = await this.getUserByEmail(dto.userEmail);
      if (!userInfo)
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Usuario no encontrado con el email proporcionado',
        });

      // 2. Validar que el plan existe
      const plan = await this.membershipPlanRepository.findOne({
        where: { id: dto.planId },
      });

      if (!plan)
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: 'Plan de membresía no encontrado',
        });

      // 3. Calcular pricing y determinar si es upgrade o nueva membresía
      const pricingInfo = await this.calculatePricingWithRollback(
        userInfo.id,
        dto.planId,
      );

      this.logger.log(
        `💰 Información de pricing: ${JSON.stringify(pricingInfo)}`,
      );

      let membership: Membership;
      let membershipAction: MembershipAction;

      // 4. Procesar según si es upgrade o nueva membresía
      if (pricingInfo.isUpgrade && pricingInfo.currentMembership) {
        // Es un upgrade
        membership = await this.updateMembershipForUpgrade(
          pricingInfo.currentMembership,
          plan,
          MembershipStatus.ACTIVE,
        );
        membershipAction = MembershipAction.UPGRADE;

        this.logger.log(
          `⬆️ Upgrade procesado para membresía ID: ${membership.id}`,
        );
      } else {
        // Es una nueva membresía
        membership = await this.createMembership(
          userInfo.id,
          userInfo,
          dto.planId,
          undefined,
          MembershipStatus.ACTIVE,
        );
        membershipAction = MembershipAction.CREATED;

        this.logger.log(`✨ Nueva membresía creada con ID: ${membership.id}`);
      }

      // 5. Crear historial de membresía
      await this.createMembershipHistory(
        membership.id,
        membershipAction,
        `Razón: ${dto.reason || 'Subscripción manual de membresía'}`,
        `Procesada manualmente por administrador.`,
      );

      this.logger.log(
        `✅ Suscripción manual procesada exitosamente para usuario ${userInfo.id}`,
      );

      return {
        success: true,
        membershipId: membership.id,
        message: pricingInfo.isUpgrade
          ? 'Upgrade de membresía procesado exitosamente'
          : 'Nueva membresía creada exitosamente',
        isUpgrade: pricingInfo.isUpgrade,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error procesando suscripción manual: ${error.message}`,
        error.stack,
      );

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno del servidor al procesar suscripción manual',
      });
    }
  }

  /**
   * Busca un usuario por email usando el microservicio de usuarios
   */
  private async getUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    fullName: string;
  } | null> {
    try {
      this.logger.log(`👤 Buscando usuario por email: ${email}`);

      const userInfo = await firstValueFrom(
        this.usersClient.send({ cmd: 'user.findByEmailMS' }, { email: email }),
      );

      if (!userInfo) {
        this.logger.warn(`❌ Usuario no encontrado con email: ${email}`);
        return null;
      }

      this.logger.log(
        `✅ Usuario encontrado: ${userInfo.id} - ${userInfo.fullName}`,
      );

      return userInfo;
    } catch (error) {
      this.logger.error(
        `❌ Error buscando usuario por email ${email}: ${error.message}`,
      );
      return null;
    }
  }

  // Implementación requerida del método abstracto (no usado en este servicio)
  processSubscription(): Promise<any> {
    throw new Error(
      'Method not implemented - Use processManualSubscription instead',
    );
  }
}
