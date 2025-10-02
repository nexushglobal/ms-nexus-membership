import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export enum MembershipListOrderBy {
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
}

export class ListMembershipsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string; // Término de búsqueda por correo o nombre

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  welcomeKitDelivered?: boolean; // Filtro por entrega de kit

  @IsOptional()
  @IsEnum(MembershipListOrderBy)
  orderBy?: MembershipListOrderBy; // Orden: NEWEST (default) o OLDEST
}

export class MembershipListItemDto {
  id: number;
  userName: string; // Nombre completo
  userEmail: string; // Correo electrónico
  planName: string; // Nombre del plan de membresía
  startDate: Date; // Fecha de inicio
  endDate: Date | null; // Fecha final
  status: string; // Estado de la membresía (ACTIVE, INACTIVE, etc.)
  welcomeKitDelivered: boolean; // Si se entregó el kit
  createdAt: Date; // Fecha de creación del registro
}

export class ListMembershipsResponseDto {
  items: MembershipListItemDto[];
}
