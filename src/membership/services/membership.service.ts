import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipReconsumptionService } from 'src/membership-reconsumption/membership-reconsumption.service';
import { Membership, MembershipStatus } from '../entities/membership.entity';
import { UserMembershipInfoDto } from '../dto/user-membership-info.dto';
import { BaseService } from 'src/common/services/base.service';
import { GetMembershipDetailResponseDto } from '../dto/get-membership-detail.dto';
import { formatGetMembershipDetailResponse } from '../helpers/format-get-membership-detail-response.helper';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class MembershipService extends BaseService<Membership> {
  private readonly logger = new Logger(MembershipService.name);
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
    private readonly membershipReconsumptionService: MembershipReconsumptionService,
  ) {
    super(membershipRepository);
  }
  async getUserMembershipInfo(userId: string): Promise<UserMembershipInfoDto> {
    const userMembership = await this.membershipRepository.findOne({
      where: { userId },
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
}
