import { IsNotEmpty, IsString } from 'class-validator';

export class GetUserMembershipStatusDto {
  @IsString({ message: 'userId debe ser un string válido' })
  @IsNotEmpty({ message: 'userId no puede estar vacío' })
  userId: string;
}
