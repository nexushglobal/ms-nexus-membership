import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MembershipMigrationData } from '../interfaces/membership.interfaces';
import { MembershipMigrationService } from '../services/membership-migration.service';

interface MembershipMigrationPayload {
  memberships: MembershipMigrationData[];
}

@Controller()
export class MembershipMigrationController {
  private readonly logger = new Logger(MembershipMigrationController.name);

  constructor(
    private readonly membershipMigrationService: MembershipMigrationService,
  ) {}

  @MessagePattern({ cmd: 'membership.migrate.memberships' })
  async migrateMemberships(@Payload() payload: MembershipMigrationPayload) {
    this.logger.log('📨 Solicitud de migración de membresías recibida');

    if (!payload.memberships || !Array.isArray(payload.memberships)) {
      throw new Error(
        'Faltan datos requeridos: memberships es obligatorio y debe ser un array',
      );
    }

    this.logger.log(
      `📊 Total de membresías a migrar: ${payload.memberships.length}`,
    );

    const validation = this.membershipMigrationService.validateMembershipData(
      payload.memberships,
    );

    if (!validation.valid) {
      throw new Error(
        `Datos de membresías inválidos: ${validation.errors.join(', ')}`,
      );
    }

    const result = await this.membershipMigrationService.migrateMemberships(
      payload.memberships,
    );

    return result;
  }
}
