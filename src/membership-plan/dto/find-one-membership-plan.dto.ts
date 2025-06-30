import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class FindOneMembershipPlanDto {
  @IsNotEmpty({ message: 'El campo id no puede estar vacío' })
  @IsNumber({}, { message: 'El campo id debe ser un número' })
  id: number;

  @IsNotEmpty({ message: 'El campo userId no puede estar vacío' })
  @IsString({ message: 'El campo userId debe ser un string' })
  userId: string;
}
