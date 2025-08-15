import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paginated } from 'src/common/dto/paginated.dto';
import { BaseService } from 'src/common/services/base.service';
import { FindByMembershipIdDto } from 'src/membership-reconsumption/dto/find-by-membership-id.dto';
import { Repository } from 'typeorm';
import { MembershipHistory } from '../entities/membership-history.entity';
import { MembershipService } from './membership.service';

@Injectable()
export class MembershipHistoryService extends BaseService<MembershipHistory> {
  constructor(
    @InjectRepository(MembershipHistory)
    private readonly membershipHistoryRepository: Repository<MembershipHistory>,
    private readonly membershipService: MembershipService,
  ) {
    super(membershipHistoryRepository);
  }
  async findAllByMembershipId(
    data: FindByMembershipIdDto,
  ): Promise<Paginated<MembershipHistory>> {
    const { userId, ...paginationDto } = data;
    const membership = await this.membershipService.findOneByUserId(userId);
    const membershipHistory = await this.membershipHistoryRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.membership', 'membership')
      .where('membership.id = :membershipId', { membershipId: membership.id })
      .orderBy('history.createdAt', 'DESC')
      .select(['history'])
      .getMany();
    return this.findAllBase(membershipHistory, paginationDto);
  }
}
