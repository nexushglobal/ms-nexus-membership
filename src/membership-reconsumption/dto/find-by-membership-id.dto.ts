import { Paginated } from 'src/common/dto/paginated.dto';
import { MembershipReconsumption } from '../entities/membership-reconsumption.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class FindByMembershipIdDto extends PaginationDto {
  @IsString({ message: 'El campo userId debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El campo userId no puede estar vacío' })
  userId: string;
}

export class FindByMembershipIdResponseDto {
  infoReconsumptions: Paginated<MembershipReconsumption>;
  canReconsume: boolean;
  autoRenewal: boolean;
  reconsumptionAmount: number;
}
