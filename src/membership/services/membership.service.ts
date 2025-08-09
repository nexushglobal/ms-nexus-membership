import {
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseService } from 'src/common/services/base.service';
import { MembershipReconsumptionService } from 'src/membership-reconsumption/membership-reconsumption.service';
import { In, Repository } from 'typeorm';
import {
  CheckUserActiveMembershipResponseDto,
  UserActiveMembershipResultDto,
} from '../dto/check-user-active-membership.dto';
import { GetMembershipDetailResponseDto } from '../dto/get-membership-detail.dto';
import { GetUserMembershipByUserIdResponseDto } from '../dto/get-user-membership-by-user-id.dto';
import { UserMembershipInfoDto } from '../dto/user-membership-info.dto';
import { Membership, MembershipStatus } from '../entities/membership.entity';
import { formatGetMembershipDetailResponse } from '../helpers/format-get-membership-detail-response.helper';

@Injectable()
export class MembershipService extends BaseService<Membership> {
  private readonly logger = new Logger(MembershipService.name);
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    @Inject(forwardRef(() => MembershipReconsumptionService))
    private readonly membershipReconsumptionService: MembershipReconsumptionService,
  ) {
    super(membershipRepository);
  }
  async getUserMembershipInfo(userId: string): Promise<UserMembershipInfoDto> {
    const userMembership = await this.membershipRepository.findOne({
      where: {
        userId,
        status: In([
          MembershipStatus.ACTIVE,
          MembershipStatus.PENDING,
          MembershipStatus.EXPIRED,
          MembershipStatus.INACTIVE,
        ]),
      },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });

    if (!userMembership)
      return {
        hasMembership: false,
        message: 'El usuario no tiene ninguna membresía.',
      };

    const response: UserMembershipInfoDto = {
      hasMembership: true,
      membershipId: userMembership.id,
      status: userMembership.status,
      plan: {
        id: userMembership.plan.id,
        name: userMembership.plan.name,
        price: userMembership.plan.price,
      },
      endDate: userMembership.endDate,
    };

    switch (userMembership.status) {
      case MembershipStatus.PENDING:
        response.message =
          'Tienes una solicitud de membresía pendiente de aprobación.';
        break;
      case MembershipStatus.ACTIVE:
        response.message = 'Tu membresía está activa.';
        break;
      case MembershipStatus.EXPIRED:
        response.message = 'Tu membresía ha expirado. Considera renovarla.';
        break;
      case MembershipStatus.INACTIVE:
        response.message =
          'Tu membresía está inactiva. Contacta a soporte para más información.';
        break;
    }
    return response;
  }

  async getMembershipDetail(
    userId: string,
  ): Promise<GetMembershipDetailResponseDto> {
    const membership = await this.findOneByUserId(userId);
    // Obtener último reconsumo
    const lastReconsumption =
      await this.membershipReconsumptionService.findOneLastReconsumption(
        membership.id,
      );
    // Obtener próxima fecha de reconsumo
    const nextReconsumptionDate = new Date(membership.endDate);
    // Verificar si puede hacer reconsumo
    const pendingReconsumption =
      await this.membershipReconsumptionService.pendingReconsumption(
        membership.id,
      );
    const today = new Date();
    const canReconsume =
      !pendingReconsumption && today >= nextReconsumptionDate;

    return formatGetMembershipDetailResponse(
      membership,
      lastReconsumption,
      pendingReconsumption,
      canReconsume,
    );
  }

  async findOneByUserId(userId: string): Promise<Membership> {
    const membership = await this.membershipRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.plan', 'plan')
      .where('membership.userId = :userId', { userId })
      .andWhere('membership.status = :status', {
        status: MembershipStatus.ACTIVE,
      })
      .getOne();
    if (!membership)
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: 'El usuario no tiene una membresía activa',
      });
    return membership;
  }

  async getUserMembershipByUserId(
    userId: string,
  ): Promise<GetUserMembershipByUserIdResponseDto> {
    try {
      // Buscar membresía activa del usuario
      const membership = await this.membershipRepository.findOne({
        where: {
          userId,
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      });

      // Si no tiene membresía activa
      if (!membership) {
        return {
          hasActiveMembership: false,
          message: 'El usuario no tiene membresía activa',
        };
      }

      // Si tiene membresía activa, retornar los datos
      return {
        hasActiveMembership: true,
        id: membership.id,
        userId: membership.userId,
        userName: membership.userName,
        userEmail: membership.userEmail,
        plan: {
          id: membership.plan.id,
          name: membership.plan.name,
          commissionPercentage: membership.plan.commissionPercentage,
          directCommissionAmount: membership.plan.directCommissionAmount,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting user membership for userId ${userId}: ${error.message}`,
      );

      // Si es un error relacionado con que el usuario no existe
      if (
        error.message.includes('user not found') ||
        error.message.includes('usuario no existe')
      ) {
        return {
          hasActiveMembership: false,
          message: 'El usuario no existe',
        };
      }

      // Para otros errores, retornar mensaje genérico
      return {
        hasActiveMembership: false,
        message: 'Error al obtener información de membresía del usuario',
      };
    }
  }

  async checkUserActiveMembership(
    userIds: string[],
  ): Promise<CheckUserActiveMembershipResponseDto> {
    try {
      // Buscar todas las membresías activas para los usuarios proporcionados
      const activeMemberships = await this.membershipRepository.find({
        where: {
          userId: In(userIds),
          status: MembershipStatus.ACTIVE,
        },
        select: ['userId'],
      });

      // Crear un Set de userIds que tienen membresía activa para búsqueda O(1)
      const activeUserIds = new Set(
        activeMemberships.map((membership) => membership.userId),
      );

      // Construir el array de resultados
      const results: UserActiveMembershipResultDto[] = userIds.map(
        (userId) => ({
          userId,
          active: activeUserIds.has(userId),
        }),
      );

      return {
        results,
      };
    } catch (error) {
      this.logger.error(
        `Error checking active memberships for userIds ${userIds.join(', ')}: ${error.message}`,
      );

      // En caso de cualquier error, retornar false para todos los usuarios
      const results: UserActiveMembershipResultDto[] = userIds.map(
        (userId) => ({
          userId,
          active: false,
        }),
      );

      return {
        results,
      };
    }
  }
}
