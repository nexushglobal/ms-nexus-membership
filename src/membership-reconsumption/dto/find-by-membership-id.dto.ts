import { IsNotEmpty, IsString } from 'class-validator';
import { Paginated } from 'src/common/dto/paginated.dto';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { MembershipStatus } from 'src/membership/entities/membership.entity';
import { MembershipReconsumption } from '../entities/membership-reconsumption.entity';

export class FindByMembershipIdDto extends PaginationDto {
  @IsString({ message: 'El campo userId debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El campo userId no puede estar vacío' })
  userId: string;
}

export class FindByMembershipIdResponseDto {
  infoReconsumptions: Paginated<MembershipReconsumption>;

  membership: {
    useCard: boolean;
    isPointLot: boolean;
    status: MembershipStatus;
    canReconsume: boolean;
    autoRenewal: boolean;
    reconsumptionAmount: number;
    startDate: Date;
    endDate: Date;
  };
}
