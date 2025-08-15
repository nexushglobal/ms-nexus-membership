import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseService } from 'src/common/services/base.service';
import { MembershipService } from 'src/membership/services/membership.service';
import { Repository } from 'typeorm';
import {
  FindByMembershipIdDto,
  FindByMembershipIdResponseDto,
} from './dto/find-by-membership-id.dto';
import {
  MembershipReconsumption,
  ReconsumptionStatus,
} from './entities/membership-reconsumption.entity';

@Injectable()
export class MembershipReconsumptionService extends BaseService<MembershipReconsumption> {
  constructor(
    @InjectRepository(MembershipReconsumption)
    private readonly membershipReconsumptionRepository: Repository<MembershipReconsumption>,
    @Inject(forwardRef(() => MembershipService))
    private readonly membershipService: MembershipService,
  ) {
    super(membershipReconsumptionRepository);
  }

  async findByMembershipId(
    data: FindByMembershipIdDto,
  ): Promise<FindByMembershipIdResponseDto> {
    const { userId, ...paginationDto } = data;
    const membership = await this.membershipService.findOneByUserId(userId);
    const queryBuilder = await this.membershipReconsumptionRepository
      .createQueryBuilder('reconsumption')
      .leftJoinAndSelect('reconsumption.membership', 'membership')
      .where('membership.id = :membershipId', { membershipId: membership.id })
      .orderBy('reconsumption.createdAt', 'DESC')

      .getMany();
    const pendingReconsumption =
      await this.membershipReconsumptionRepository.findOne({
        where: {
          membership: { id: membership.id },
          status: ReconsumptionStatus.PENDING,
        },
      });
    const nextReconsumptionDate = new Date(membership.endDate);
    const canReconsume =
      !pendingReconsumption && new Date() >= nextReconsumptionDate;
    const autoRenewal = membership.autoRenewal;
    const reconsumptionAmount = membership.minimumReconsumptionAmount;
    const infoReconsumptions = await this.findAllBase(
      queryBuilder,
      paginationDto,
    );

    return {
      infoReconsumptions,
      canReconsume,
      autoRenewal,
      reconsumptionAmount,
      membership: {
        typeReconsumption: membership.typeReconsumption,
        useCard: membership.useCard,
      },
    };
  }

  async findOneLastReconsumption(
    membershipId: number,
  ): Promise<MembershipReconsumption | null> {
    const lastReconsumption =
      await this.membershipReconsumptionRepository.findOne({
        where: { membership: { id: membershipId } },
        order: { periodDate: 'DESC' },
      });
    return lastReconsumption;
  }

  async pendingReconsumption(
    membershipId: number,
  ): Promise<MembershipReconsumption | null> {
    const pendingReconsumption =
      await this.membershipReconsumptionRepository.findOne({
        where: {
          membership: { id: membershipId },
          status: ReconsumptionStatus.PENDING,
        },
      });
    return pendingReconsumption;
  }
}
