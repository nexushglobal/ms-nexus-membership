import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Membership } from '../entities/membership.entity';

@Injectable()
export class UserMembershipStatusService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
  ) {}

  async getUserMembershipStatus(userId: string) {
    try {
      // Buscar la membresía activa del usuario
      const membership = await this.membershipRepository
        .createQueryBuilder('membership')
        .leftJoinAndSelect('membership.plan', 'plan')
        .where('membership.userId = :userId', { userId })
        .orderBy('membership.createdAt', 'DESC')
        .getOne();

      if (!membership) {
        return {
          hasMembership: false,
          membership: null,
        };
      }

      return {
        hasMembership: true,
        membership: {
          id: membership.id.toString(),
          startDate: membership.startDate,
          endDate: membership.endDate,
          status: membership.status,
          planName: membership.plan.name,
          minimumReconsumptionAmount: membership.minimumReconsumptionAmount,
        },
      };
    } catch (error) {
      throw new RpcException({
        message: 'Error al obtener el estado de membresía del usuario',
        code: 'USER_MEMBERSHIP_STATUS_ERROR',
        details: error.message,
      });
    }
  }
}
