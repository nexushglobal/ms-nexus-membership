import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FindMembershipPlansDto {
  @IsNotEmpty({ message: 'El campo userId no puede estar vacío' })
  @IsString({ message: 'El campo userId debe ser un string' })
  userId: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;
}
