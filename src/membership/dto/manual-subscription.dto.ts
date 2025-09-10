import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateManualSubscriptionDto {
  @IsEmail({}, { message: 'Debe proporcionar un email válido' })
  @IsNotEmpty({ message: 'El email es requerido' })
  userEmail: string;

  @IsNumber({}, { message: 'El ID del plan debe ser un número' })
  @Min(1, { message: 'El ID del plan debe ser mayor a 0' })
  planId: number;

  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsOptional()
  reason: string;
}

export class CreateManualSubscriptionResponseDto {
  success: boolean;
  membershipId: number;
  message: string;
  isUpgrade: boolean;
}
