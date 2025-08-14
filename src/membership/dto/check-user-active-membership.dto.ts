import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';

export class UserIdDto {
  @IsNotEmpty()
  @IsString()
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
