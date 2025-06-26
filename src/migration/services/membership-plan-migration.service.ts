import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MembershipPlan } from 'src/membership/entities/membership-plan.entity';
import { Repository } from 'typeorm';
import {
  MembershipPlanMigrationData,
  MembershipPlanMigrationResult,
} from '../interfaces/membership-plan.interfaces';

@Injectable()
export class MembershipPlanMigrationService {
  private readonly logger = new Logger(MembershipPlanMigrationService.name);

  constructor(
    @InjectRepository(MembershipPlan)
    private membershipPlanRepository: Repository<MembershipPlan>,
  ) {}

  async migrateMembershipPlans(
    membershipPlansData: MembershipPlanMigrationData[],
  ): Promise<MembershipPlanMigrationResult> {
    this.logger.log('🚀 Iniciando migración de planes de membresía...');

    const result: MembershipPlanMigrationResult = {
      success: true,
      message: '',
      details: {
        membershipPlans: { total: 0, created: 0, skipped: 0, errors: [] },
      },
    };

    try {
      this.logger.log('📋 Migrando planes de membresía...');
      await this.createMembershipPlans(
        membershipPlansData,
        result.details.membershipPlans,
      );

      result.message =
        'Migración de planes de membresía completada exitosamente';
      this.logger.log(
        '✅ Migración de planes de membresía completada exitosamente',
      );
    } catch (error) {
      result.success = false;
      result.message = `Error durante la migración de planes de membresía: ${error.message}`;
      this.logger.error(
        '❌ Error durante la migración de planes de membresía:',
        error,
      );
      throw error;
    }

    return result;
  }

  private async createMembershipPlans(
    membershipPlansData: MembershipPlanMigrationData[],
    details: any,
  ): Promise<void> {
    details.total = membershipPlansData.length;

    for (const planData of membershipPlansData) {
      try {
        // Verificar si el plan ya existe por ID
        const existingPlan = await this.membershipPlanRepository.findOne({
          where: { id: planData.id },
        });

        if (existingPlan) {
          this.logger.warn(
            `⚠️ Plan de membresía con ID ${planData.id} ya existe, saltando...`,
          );
          details.skipped++;
          continue;
        }

        // Limpiar y validar arrays
        const cleanProducts = this.cleanStringArray(planData.products);
        const cleanBenefits = this.cleanStringArray(planData.benefits);

        // Crear nuevo plan de membresía conservando el ID original
        const newMembershipPlan = this.membershipPlanRepository.create({
          id: planData.id, // ⭐ Conservar el ID original
          name: planData.name.trim(),
          price: Number(planData.price),
          checkAmount: Number(planData.checkAmount),
          binaryPoints: Number(planData.binaryPoints),
          commissionPercentage: Number(planData.commissionPercentage),
          directCommissionAmount: planData.directCommissionAmount
            ? Number(planData.directCommissionAmount)
            : undefined,
          products: cleanProducts,
          benefits: cleanBenefits,
          isActive: Boolean(planData.isActive),
          displayOrder: Number(planData.displayOrder),
          createdAt: new Date(planData.createdAt),
          updatedAt: new Date(planData.updatedAt),
        });

        const savedPlan =
          await this.membershipPlanRepository.save(newMembershipPlan);
        details.created++;

        this.logger.log(
          `✅ Plan de membresía creado: ${planData.name} -> ID: ${savedPlan.id} (conservado)`,
        );
      } catch (error) {
        const errorMsg = `Error creando plan de membresía ${planData.name} (ID: ${planData.id}): ${error.message}`;
        details.errors.push(errorMsg);
        this.logger.error(`❌ ${errorMsg}`);
      }
    }
  }

  private cleanStringArray(array: string[]): string[] {
    if (!Array.isArray(array)) {
      return [];
    }

    return array
      .filter((item) => item && typeof item === 'string' && item.trim())
      .map((item) => item.trim());
  }

  validateMembershipPlanData(membershipPlansData: any[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!Array.isArray(membershipPlansData)) {
      errors.push('Los datos de planes de membresía deben ser un array');
      return { valid: false, errors };
    }

    membershipPlansData.forEach((plan, index) => {
      const requiredFields = [
        'id',
        'name',
        'price',
        'checkAmount',
        'binaryPoints',
        'commissionPercentage',
        'products',
        'benefits',
        'isActive',
        'displayOrder',
        'createdAt',
        'updatedAt',
      ];

      for (const field of requiredFields) {
        if (plan[field] === undefined || plan[field] === null) {
          errors.push(
            `Plan de membresía en índice ${index} falta el campo requerido: ${field}`,
          );
        }
      }

      // Validar que el ID sea un número válido
      if (plan.id !== undefined) {
        const planId = Number(plan.id);
        if (isNaN(planId) || planId <= 0) {
          errors.push(
            `Plan de membresía en índice ${index} tiene un ID inválido: ${plan.id}`,
          );
        }
      }

      // Validar que el nombre no esté vacío
      if (plan.name && typeof plan.name === 'string') {
        const cleanName = plan.name.trim();
        if (!cleanName) {
          errors.push(
            `Plan de membresía en índice ${index} tiene un nombre vacío`,
          );
        }
      }

      // Validar que los valores numéricos sean válidos
      const numericFields = [
        'price',
        'checkAmount',
        'binaryPoints',
        'commissionPercentage',
        'displayOrder',
      ];

      for (const field of numericFields) {
        if (
          plan[field] !== undefined &&
          (isNaN(Number(plan[field])) || Number(plan[field]) < 0)
        ) {
          errors.push(
            `Plan de membresía en índice ${index} tiene un valor inválido para ${field}: ${plan[field]}`,
          );
        }
      }

      // Validar que commissionPercentage esté entre 0 y 100
      if (
        plan.commissionPercentage !== undefined &&
        (Number(plan.commissionPercentage) < 0 ||
          Number(plan.commissionPercentage) > 100)
      ) {
        errors.push(
          `Plan de membresía en índice ${index} tiene un porcentaje de comisión inválido: ${plan.commissionPercentage}`,
        );
      }

      // Validar que products y benefits sean arrays
      if (plan.products && !Array.isArray(plan.products)) {
        errors.push(
          `Plan de membresía en índice ${index} - products debe ser un array`,
        );
      }

      if (plan.benefits && !Array.isArray(plan.benefits)) {
        errors.push(
          `Plan de membresía en índice ${index} - benefits debe ser un array`,
        );
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
