import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { MembershipStatus } from 'src/membership/entities/membership.entity';
import { MembershipService } from 'src/membership/services/membership.service';
import { Repository } from 'typeorm';
import { FindMembershipPlansDto } from './dto/find-membership-plan.dto';
import { MembershipPlanWithUpgradeDto } from './dto/membership-plan-with-upgrade.dto';
import { MembershipPlan } from './entities/membership-plan.entity';

@Injectable()
export class MembershipPlanService {
  private readonly logger = new Logger(MembershipPlanService.name);
  constructor(
    @InjectRepository(MembershipPlan)
    private readonly membershipPlanRepository: Repository<MembershipPlan>,
    private readonly membershipService: MembershipService,
  ) {}
  async findAll(findMembershipPlansDto: FindMembershipPlansDto) {
    const { userId, isActive } = findMembershipPlansDto;
    try {
      const userMembershipInfo =
        await this.membershipService.getUserMembershipInfo(userId);
      const queryBuilder =
        this.membershipPlanRepository.createQueryBuilder('plan');

      if (isActive !== undefined) {
        queryBuilder.where('plan.isActive = :isActive', {
          isActive,
        });
      } else {
        queryBuilder.where('plan.isActive = :isActive', { isActive: true });
      }

      // Si el usuario tiene membresía activa, solo mostrar planes superiores
      if (
        userMembershipInfo.hasMembership &&
        userMembershipInfo.status === MembershipStatus.ACTIVE
      ) {
        queryBuilder.andWhere('plan.price > :currentPrice', {
          currentPrice: userMembershipInfo.plan?.price,
        });

        queryBuilder.andWhere('plan.id != :currentPlanId', {
          currentPlanId: userMembershipInfo.plan?.id,
        });
      }

      queryBuilder.orderBy('plan.displayOrder', 'ASC');
      queryBuilder.addOrderBy('plan.name', 'ASC');
      const plans: MembershipPlan[] = await queryBuilder.getMany();

      let transformedPlans: MembershipPlanWithUpgradeDto[];

      if (
        userMembershipInfo.hasMembership &&
        userMembershipInfo.status === MembershipStatus.ACTIVE &&
        userMembershipInfo.plan
      ) {
        transformedPlans = plans.map((plan): MembershipPlanWithUpgradeDto => {
          const upgradeCost = plan.price - userMembershipInfo.plan!.price;
          return {
            ...plan,
            upgradeCost: Math.max(0, upgradeCost),
            isUpgrade: true,
          };
        });
      } else {
        transformedPlans = plans;
      }

      return {
        plans: transformedPlans,
        userMembership: userMembershipInfo,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `Error al obtener planes de membresía: ${errorMessage}`,
      );
      throw error;
    }
  }

  async findOne(id: number, userId: string) {
    try {
      const userMembershipInfo =
        await this.membershipService.getUserMembershipInfo(userId);

      const plan = await this.membershipPlanRepository.findOne({
        where: { id },
      });

      if (!plan)
        throw new RpcException({
          status: HttpStatus.NOT_FOUND,
          message: `Plan de membresía con ID ${id} no encontrado`,
        });
      const result = { ...plan };

      // Si el usuario tiene membresía activa, calcular información de upgrade
      if (
        userMembershipInfo.hasMembership &&
        userMembershipInfo.status === MembershipStatus.ACTIVE
      ) {
        const upgradeCost = plan.price - userMembershipInfo.plan!.price;

        if (plan.price <= userMembershipInfo.plan!.price) {
          result['warning'] =
            'Este plan es de igual o menor valor que tu plan actual. No es recomendable cambiar.';
        }

        result['upgradeCost'] = Math.max(0, upgradeCost);
        result['isUpgrade'] = true;
      }

      return {
        plan: result,
        userMembership: userMembershipInfo,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(
        `Error al obtener planes de membresía: ${errorMessage}`,
      );
      throw error;
    }
  }
}
