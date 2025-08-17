import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateMembershipDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsBoolean()
  isPointLot?: boolean;

  @IsOptional()
  @IsBoolean()
  useCard?: boolean;

  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;
}

export class UpdateMembershipResponseDto {
  id: number;
  userId: string;
  isPointLot: boolean;
  useCard: boolean;
  autoRenewal: boolean;
}
