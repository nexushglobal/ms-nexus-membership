import { IsBoolean, IsNumber } from 'class-validator';

export class UpdateWelcomeKitStatusDto {
  @IsNumber()
  membershipId: number; // ID de la membresía cuyo estado de kit se va a actualizar

  @IsBoolean()
  welcomeKitDelivered: boolean; // true si se entregó, false si no
}

export class UpdateWelcomeKitStatusResponseDto {
  message: string;
}
