import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class UserIdDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  userId: string;
}

export class CheckUserActiveMembershipDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserIdDto)
  users: UserIdDto[];
}

export class UserActiveMembershipResultDto {
  userId: string;
  active: boolean;
}

export class CheckUserActiveMembershipResponseDto {
  results: UserActiveMembershipResultDto[];
}
