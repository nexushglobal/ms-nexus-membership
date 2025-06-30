import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Membership, MembershipStatus } from './entities/membership.entity';
import { Repository } from 'typeorm';
import { UserMembershipInfoDto } from './dto/user-membership-info.dto';

@Injectable()
export class MembershipService {
  constructor(
    @InjectRepository(Membership)
    private readonly membershipRepository: Repository<Membership>,
  ) {}
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
}
