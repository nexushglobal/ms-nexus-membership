import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import {
  Membership,
  MembershipStatus,
} from 'src/membership/entities/membership.entity';
import { MembershipPlan } from 'src/membership/entities/membership-plan.entity';
import {
  MembershipReconsumption,
  ReconsumptionStatus,
} from 'src/membership/entities/membership-reconsumption.entity';
import {
  MembershipHistory,
  MembershipAction,
} from 'src/membership/entities/membership-history.entity';
import { envs } from 'src/config/envs';
import {
  MembershipMigrationData,
  MembershipMigrationResult,
} from '../interfaces/membership.interfaces';

@Injectable()
export class MembershipMigrationService {
  private readonly logger = new Logger(MembershipMigrationService.name);
  private readonly usersClient: ClientProxy;

  // Ya no necesitamos mapear IDs porque conservamos los originales
  private processedMembershipIds = new Set<number>();

  constructor(
    @InjectRepository(Membership)
    private membershipRepository: Repository<Membership>,
    @InjectRepository(MembershipPlan)
    private membershipPlanRepository: Repository<MembershipPlan>,
    @InjectRepository(MembershipReconsumption)
    private membershipReconsumptionRepository: Repository<MembershipReconsumption>,
    @InjectRepository(MembershipHistory)
    private membershipHistoryRepository: Repository<MembershipHistory>,
  ) {
    this.usersClient = ClientProxyFactory.create({
      transport: Transport.NATS,
      options: {
        servers: [envs.NATS_SERVERS],
      },
    });
  }

  async migrateMemberships(
    membershipsData: MembershipMigrationData[],
  ): Promise<MembershipMigrationResult> {
    this.logger.log('🚀 Iniciando migración de membresías...');

    const result: MembershipMigrationResult = {
      success: true,
      message: '',
      details: {
        memberships: { total: 0, created: 0, skipped: 0, errors: [] },
        reconsumptions: { total: 0, created: 0, skipped: 0, errors: [] },
        history: { total: 0, created: 0, skipped: 0, errors: [] },
      },
    };

    try {
      // Limpiar set de IDs procesados
      this.processedMembershipIds.clear();

      // Paso 1: Crear membresías
      this.logger.log('🎫 Creando membresías...');
      await this.createMemberships(membershipsData, result.details.memberships);

      // Paso 2: Crear reconsumptions
      this.logger.log('🔄 Creando reconsumptions...');
      await this.createReconsumptions(
        membershipsData,
        result.details.reconsumptions,
      );

      // Paso 3: Crear historial
      this.logger.log('📜 Creando historial...');
      await this.createHistory(membershipsData, result.details.history);

      result.message = 'Migración de membresías completada exitosamente';
      this.logger.log('✅ Migración de membresías completada exitosamente');
    } catch (error) {
      result.success = false;
      result.message = `Error durante la migración de membresías: ${error.message}`;
      this.logger.error('❌ Error durante la migración de membresías:', error);
      throw error;
    }

    return result;
  }

  private async createMemberships(
    membershipsData: MembershipMigrationData[],
    details: any,
  ): Promise<void> {
    details.total = membershipsData.length;

    for (const membershipData of membershipsData) {
      try {
        // Verificar si la membresía ya existe por ID
        const existingMembership = await this.membershipRepository.findOne({
          where: { id: membershipData.membership_id },
        });

        if (existingMembership) {
          this.logger.warn(
            `⚠️ Membresía con ID ${membershipData.membership_id} ya existe, saltando...`,
          );
          this.processedMembershipIds.add(membershipData.membership_id);
          details.skipped++;
          continue;
        }

        // Buscar información del usuario por email
        const userInfo = await this.getUserByEmail(
          membershipData.useremail.trim(),
        );

        if (!userInfo) {
          const errorMsg = `Usuario no encontrado: ${membershipData.useremail}`;
          details.errors.push(errorMsg);
          this.logger.warn(`⚠️ ${errorMsg}`);
          continue;
        }

        // Verificar que el plan exista
        const plan = await this.membershipPlanRepository.findOne({
          where: { id: membershipData.plan_id },
        });

        if (!plan) {
          throw new Error(
            `Plan con ID ${membershipData.plan_id} no encontrado`,
          );
        }

        // Crear nueva membresía conservando el ID original
        const newMembership = this.membershipRepository.create({
          id: membershipData.membership_id, // ⭐ Conservar el ID original
          userId: userInfo.id,
          userEmail: userInfo.email,
          userName: userInfo.fullName,
          plan: plan,
          startDate: new Date(membershipData.startDate),
          endDate: membershipData.endDate
            ? new Date(membershipData.endDate)
            : undefined,
          status: this.mapMembershipStatus(membershipData.status),
          minimumReconsumptionAmount: Number(
            membershipData.minimumReconsumptionAmount,
          ),
          autoRenewal: Boolean(membershipData.autoRenewal),
          metadata: {
            originalId: membershipData.membership_id,
            migrationDate: new Date().toISOString(),
          },
          createdAt: new Date(membershipData.createdAt),
          updatedAt: new Date(membershipData.updatedAt),
        });

        const savedMembership =
          await this.membershipRepository.save(newMembership);
        this.processedMembershipIds.add(membershipData.membership_id);
        details.created++;

        this.logger.log(
          `✅ Membresía creada: ${membershipData.useremail} (${membershipData.plan}) -> ID: ${savedMembership.id} (conservado)`,
        );
      } catch (error) {
        const errorMsg = `Error creando membresía ${membershipData.membership_id} para ${membershipData.useremail}: ${error.message}`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
      }
    }
  }

  private async createReconsumptions(
    membershipsData: MembershipMigrationData[],
    details: any,
  ): Promise<void> {
    // Contar total de reconsumptions
    details.total = membershipsData.reduce(
      (total, membership) => total + (membership.reconsumptions?.length || 0),
      0,
    );

    for (const membershipData of membershipsData) {
      if (
        !membershipData.reconsumptions ||
        membershipData.reconsumptions.length === 0
      ) {
        continue;
      }

      // Verificar que la membresía fue procesada
      if (!this.processedMembershipIds.has(membershipData.membership_id)) {
        const errorMsg = `Membresía ${membershipData.membership_id} no fue procesada para crear reconsumptions`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
        continue;
      }

      // Buscar la membresía por ID (ya que conservamos el ID original)
      const membership = await this.membershipRepository.findOne({
        where: { id: membershipData.membership_id },
      });

      if (!membership) {
        const errorMsg = `Membresía con ID ${membershipData.membership_id} no encontrada para crear reconsumptions`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
        continue;
      }

      for (const reconsumptionData of membershipData.reconsumptions) {
        try {
          // Verificar si el reconsumption ya existe
          const existingReconsumption =
            await this.membershipReconsumptionRepository.findOne({
              where: {
                membership: { id: membershipData.membership_id },
                periodDate: new Date(reconsumptionData.periodDate),
                amount: Number(reconsumptionData.amount),
              },
            });

          if (existingReconsumption) {
            this.logger.warn(
              `⚠️ Reconsumption ya existe para membresía ${membershipData.membership_id}, saltando...`,
            );
            details.skipped++;
            continue;
          }

          const newReconsumption =
            this.membershipReconsumptionRepository.create({
              id: reconsumptionData.id, // ⭐ Conservar el ID original
              membership: membership,
              amount: Number(reconsumptionData.amount),
              status: this.mapReconsumptionStatus(reconsumptionData.status),
              periodDate: new Date(reconsumptionData.periodDate),
              paymentReference:
                reconsumptionData.paymentReference?.trim() || undefined,
              paymentDetails: reconsumptionData.paymentDetails || undefined,
              notes: reconsumptionData.notes?.trim() || undefined,
              createdAt: new Date(reconsumptionData.createdAt),
              updatedAt: new Date(reconsumptionData.updatedAt),
            });

          await this.membershipReconsumptionRepository.save(newReconsumption);
          details.created++;

          this.logger.log(
            `✅ Reconsumption creado para membresía ${membershipData.membership_id}: ${reconsumptionData.amount}`,
          );
        } catch (error) {
          const errorMsg = `Error creando reconsumption para membresía ${membershipData.membership_id}: ${error.message}`;
          details.errors.push(errorMsg);
          this.logger.error(`❌ ${errorMsg}`);
        }
      }
    }
  }

  private async createHistory(
    membershipsData: MembershipMigrationData[],
    details: any,
  ): Promise<void> {
    // Contar total de history entries
    details.total = membershipsData.reduce(
      (total, membership) =>
        total + (membership.membership_history?.length || 0),
      0,
    );

    for (const membershipData of membershipsData) {
      if (
        !membershipData.membership_history ||
        membershipData.membership_history.length === 0
      ) {
        continue;
      }

      // Verificar que la membresía fue procesada
      if (!this.processedMembershipIds.has(membershipData.membership_id)) {
        const errorMsg = `Membresía ${membershipData.membership_id} no fue procesada para crear historial`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
        continue;
      }

      // Buscar la membresía por ID (ya que conservamos el ID original)
      const membership = await this.membershipRepository.findOne({
        where: { id: membershipData.membership_id },
      });

      if (!membership) {
        const errorMsg = `Membresía con ID ${membershipData.membership_id} no encontrada para crear historial`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
        continue;
      }

      for (const historyData of membershipData.membership_history) {
        try {
          const newHistory = this.membershipHistoryRepository.create({
            id: historyData.id, // ⭐ Conservar el ID original
            membership: membership,
            action: this.mapMembershipAction(historyData.action),
            changes: historyData.changes || undefined,
            notes: historyData.notes?.trim() || undefined,
            metadata: {
              ...historyData.metadata,
              originalId: historyData.id,
              migrationDate: new Date().toISOString(),
            },
            createdAt: new Date(historyData.createdAt),
          });

          await this.membershipHistoryRepository.save(newHistory);
          details.created++;

          this.logger.log(
            `✅ Historia creada para membresía ${membershipData.membership_id}: ${historyData.action}`,
          );
        } catch (error) {
          const errorMsg = `Error creando historia para membresía ${membershipData.membership_id}: ${error.message}`;
          details.errors.push(errorMsg);
          this.logger.error(`❌ ${errorMsg}`);
        }
      }
    }
  }

  private async getUserByEmail(email: string): Promise<{
    id: string;
    email: string;
    fullName: string;
  } | null> {
    try {
      const user = await firstValueFrom(
        this.usersClient.send(
          { cmd: 'user.findByEmailMS' },
          { email: email.toLowerCase().trim() },
        ),
      );

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      };
    } catch (error) {
      this.logger.error(`Error buscando usuario por email ${email}:`, error);
      return null;
    }
  }

  private mapMembershipStatus(status: string): MembershipStatus {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return MembershipStatus.PENDING;
      case 'ACTIVE':
        return MembershipStatus.ACTIVE;
      case 'INACTIVE':
        return MembershipStatus.INACTIVE;
      case 'EXPIRED':
        return MembershipStatus.EXPIRED;
      default:
        return MembershipStatus.PENDING;
    }
  }

  private mapReconsumptionStatus(status: string): ReconsumptionStatus {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return ReconsumptionStatus.PENDING;
      case 'ACTIVE':
        return ReconsumptionStatus.ACTIVE;
      case 'CANCELLED':
        return ReconsumptionStatus.CANCELLED;
      default:
        return ReconsumptionStatus.PENDING;
    }
  }

  private mapMembershipAction(action: string): MembershipAction {
    switch (action.toUpperCase()) {
      case 'CREATED':
        return MembershipAction.CREATED;
      case 'RENEWED':
        return MembershipAction.RENEWED;
      case 'CANCELLED':
        return MembershipAction.CANCELLED;
      case 'REACTIVATED':
        return MembershipAction.REACTIVATED;
      case 'EXPIRED':
        return MembershipAction.EXPIRED;
      case 'STATUS_CHANGED':
        return MembershipAction.STATUS_CHANGED;
      case 'PAYMENT_RECEIVED':
        return MembershipAction.PAYMENT_RECEIVED;
      case 'PLAN_CHANGED':
        return MembershipAction.PLAN_CHANGED;
      case 'RECONSUMPTION_ADDED':
        return MembershipAction.RECONSUMPTION_ADDED;
      default:
        return MembershipAction.STATUS_CHANGED;
    }
  }

  validateMembershipData(membershipsData: any[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!Array.isArray(membershipsData)) {
      errors.push('Los datos de membresías deben ser un array');
      return { valid: false, errors };
    }

    membershipsData.forEach((membership, index) => {
      // Validar campos requeridos
      const requiredFields = [
        'membership_id',
        'useremail',
        'plan_id',
        'plan',
        'startDate',
        'status',
        'minimumReconsumptionAmount',
        'autoRenewal',
        'createdAt',
        'updatedAt',
      ];

      for (const field of requiredFields) {
        if (membership[field] === undefined || membership[field] === null) {
          errors.push(
            `Membresía en índice ${index} falta el campo requerido: ${field}`,
          );
        }
      }

      // Validar que el membership_id sea un número válido
      if (membership.membership_id !== undefined) {
        const membershipId = Number(membership.membership_id);
        if (isNaN(membershipId) || membershipId <= 0) {
          errors.push(
            `Membresía en índice ${index} tiene un membership_id inválido: ${membership.membership_id}`,
          );
        }
      }

      // Validar que el plan_id sea un número válido
      if (membership.plan_id !== undefined) {
        const planId = Number(membership.plan_id);
        if (isNaN(planId) || planId <= 0) {
          errors.push(
            `Membresía en índice ${index} tiene un plan_id inválido: ${membership.plan_id}`,
          );
        }
      }

      // Validar valores numéricos
      if (membership.minimumReconsumptionAmount !== undefined) {
        const amount = Number(membership.minimumReconsumptionAmount);
        if (isNaN(amount) || amount < 0) {
          errors.push(
            `Membresía en índice ${index} tiene un monto inválido: ${membership.minimumReconsumptionAmount}`,
          );
        }
      }

      // Validar reconsumptions si existen
      if (
        membership.reconsumptions &&
        Array.isArray(membership.reconsumptions)
      ) {
        membership.reconsumptions.forEach(
          (reconsumption: any, recIndex: number) => {
            const requiredRecFields = [
              'id',
              'amount',
              'status',
              'periodDate',
              'createdAt',
              'updatedAt',
            ];

            for (const field of requiredRecFields) {
              if (
                reconsumption[field] === undefined ||
                reconsumption[field] === null
              ) {
                errors.push(
                  `Reconsumption ${recIndex} en membresía ${index} falta el campo requerido: ${field}`,
                );
              }
            }
          },
        );
      }

      // Validar history si existe
      if (
        membership.membership_history &&
        Array.isArray(membership.membership_history)
      ) {
        membership.membership_history.forEach(
          (history: any, histIndex: number) => {
            const requiredHistFields = ['id', 'action', 'createdAt'];

            for (const field of requiredHistFields) {
              if (history[field] === undefined || history[field] === null) {
                errors.push(
                  `Historia ${histIndex} en membresía ${index} falta el campo requerido: ${field}`,
                );
              }
            }
          },
        );
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async onModuleDestroy() {
    await this.usersClient.close();
  }
}
