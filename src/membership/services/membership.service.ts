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
import { UserService } from 'src/common/services/user.service';
import { MembershipReconsumptionService } from 'src/membership-reconsumption/membership-reconsumption.service';
import { In, Repository } from 'typeorm';
import {
  CheckUserActiveMembershipResponseDto,
  UserActiveMembershipResultDto,
} from '../dto/check-user-active-membership.dto';
import { GetMembershipDetailResponseDto } from '../dto/get-membership-detail.dto';
import { MembershipSubscriptionData } from '../dto/get-subscriptions-report.dto';
import { GetUserMembershipByUserIdResponseDto } from '../dto/get-user-membership-by-user-id.dto';
import {
  UpdateMembershipDto,
  UpdateMembershipResponseDto,
} from '../dto/update-membership.dto';
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
    private readonly userService: UserService,
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

  async updateMembership(
    data: UpdateMembershipDto,
  ): Promise<UpdateMembershipResponseDto> {
    const { userId, isPointLot, useCard, autoRenewal } = data;

    try {
      // Buscar la membresía activa del usuario
      const membership = await this.membershipRepository.findOne({
        where: {
          userId,
        },
      });

      if (!membership) {
        throw new RpcException(
          'El usuario no tiene una membresía activa para actualizar',
        );
      }

      // Actualizar solo los campos proporcionados
      const updateData: Partial<Membership> = {};

      if (isPointLot !== undefined) {
        updateData.isPointLot = isPointLot;
      }

      if (useCard !== undefined) {
        updateData.useCard = useCard;
      }

      if (autoRenewal !== undefined) {
        updateData.autoRenewal = autoRenewal;
      }

      // Si no hay campos para actualizar
      if (Object.keys(updateData).length === 0) {
        throw new RpcException(
          'No se proporcionaron campos válidos para actualizar',
        );
      }

      // Realizar la actualización
      await this.membershipRepository.update(membership.id, updateData);

      // Obtener la membresía actualizada
      const updatedMembership = await this.membershipRepository.findOne({
        where: { id: membership.id },
      });
      if (!updatedMembership) {
        throw new RpcException('Error al obtener la membresía actualizada');
      }

      this.logger.log(
        `Membresía actualizada para usuario ${userId}: ${JSON.stringify(updateData)}`,
      );

      return {
        id: updatedMembership.id,
        userId: updatedMembership.userId,
        isPointLot: updatedMembership.isPointLot,
        useCard: updatedMembership.useCard,
        autoRenewal: updatedMembership.autoRenewal,
      };
    } catch (error) {
      this.logger.error(
        `Error actualizando membresía para usuario ${userId}: ${error.message}`,
      );

      throw new RpcException('Error interno al actualizar la membresía');
    }
  }

  async getUsersMembershipBatch(
    userIds: string[],
  ): Promise<{ [userId: string]: GetUserMembershipByUserIdResponseDto }> {
    try {
      this.logger.log(
        `Getting memberships for ${userIds.length} users in batch`,
      );

      if (userIds.length === 0) {
        return {};
      }

      // Buscar todas las membresías activas para los usuarios proporcionados
      const memberships = await this.membershipRepository.find({
        where: {
          userId: In(userIds),
          status: MembershipStatus.ACTIVE,
        },
        relations: ['plan'],
      });

      // Crear un mapa de resultados
      const result: { [userId: string]: GetUserMembershipByUserIdResponseDto } =
        {};

      // Inicializar todos los usuarios con membresía no activa
      userIds.forEach((userId) => {
        result[userId] = {
          hasActiveMembership: false,
          message: 'El usuario no tiene membresía activa',
        };
      });

      // Llenar los datos encontrados
      memberships.forEach((membership) => {
        result[membership.userId] = {
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
      });

      this.logger.log(
        `Processed ${memberships.length} active memberships out of ${userIds.length} requested users`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error getting user memberships in batch: ${error.message}`,
      );

      // En caso de error, retornar objeto con usuarios sin membresía activa
      const result: { [userId: string]: GetUserMembershipByUserIdResponseDto } =
        {};
      userIds.forEach((userId) => {
        result[userId] = {
          hasActiveMembership: false,
          message: 'Error al obtener información de membresía del usuario',
        };
      });

      return result;
    }
  }

  async getSubscriptionsReport(
    startDate?: string,
    endDate?: string,
  ): Promise<MembershipSubscriptionData[]> {
    try {
      const queryBuilder = this.membershipRepository
        .createQueryBuilder('membership')
        .leftJoinAndSelect('membership.plan', 'plan')
        .where('membership.status = :status', {
          status: MembershipStatus.ACTIVE,
        })
        .orderBy('membership.createdAt', 'DESC');

      // Aplicar filtros de fecha si se proporcionan
      if (startDate && endDate) {
        queryBuilder.andWhere(
          'membership.createdAt BETWEEN :startDate AND :endDate',
          {
            startDate: new Date(startDate),
            endDate: new Date(endDate + 'T23:59:59.999Z'), // Final del día
          },
        );
      } else if (startDate) {
        queryBuilder.andWhere('membership.createdAt >= :startDate', {
          startDate: new Date(startDate),
        });
      } else if (endDate) {
        queryBuilder.andWhere('membership.createdAt <= :endDate', {
          endDate: new Date(endDate + 'T23:59:59.999Z'),
        });
      }

      const memberships = await queryBuilder.getMany();

      if (memberships.length === 0) {
        return [];
      }

      // Obtener información de contacto de usuarios
      const userIds = memberships.map((m) => m.userId);
      const usersContactInfo =
        await this.userService.getUsersContactInfo(userIds);

      // Crear un mapa para acceso rápido a la información de contacto
      const contactInfoMap = new Map(
        usersContactInfo.map((user) => [user.userId, user]),
      );

      return memberships.map((membership) => {
        const contactInfo = contactInfoMap.get(membership.userId);
        
        // Usar SOLO la información de contacto de la DB, no los métodos de extracción incorrectos
        const firstName = contactInfo?.firstName || '';
        const lastName = contactInfo?.lastName || '';
        const fullName = contactInfo?.fullName || 
          membership.userName || 
          (firstName && lastName ? `${firstName} ${lastName}`.trim() : '');

        return {
          id: membership.id,
          planName: membership.plan?.name || 'N/A',
          email: membership.userEmail,
          firstName: firstName,
          lastName: lastName,
          fullName: fullName,
          phone: contactInfo?.phone || '',
          created: membership.createdAt,
        };
      });
    } catch (error) {
      this.logger.error('Error generando reporte de suscripciones:', error);
      throw error;
    }
  }

  private extractFirstName(fullName: string): string {
    if (!fullName) return '';
    const nameParts = fullName.trim().split(' ');
    return nameParts[0] || '';
  }

  private extractLastName(fullName: string): string {
    if (!fullName) return '';
    const nameParts = fullName.trim().split(' ');
    return nameParts.slice(1).join(' ') || '';
  }
}
