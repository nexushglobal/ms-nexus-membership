import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { MembershipPlanMigrationData } from '../interfaces/membership-plan.interfaces';
import { MembershipPlanMigrationService } from '../services/membership-plan-migration.service';

interface MembershipPlanMigrationPayload {
  membershipPlans: MembershipPlanMigrationData[];
}

@Controller()
export class MembershipPlanMigrationController {
  private readonly logger = new Logger(MembershipPlanMigrationController.name);

  constructor(
    private readonly membershipPlanMigrationService: MembershipPlanMigrationService,
  ) {}

  @MessagePattern({ cmd: 'membership.migrate.membershipPlans' })
  async migrateMembershipPlans(
    @Payload() payload: MembershipPlanMigrationPayload,
  ) {
    this.logger.log(
      '📨 Solicitud de migración de planes de membresía recibida',
    );

    if (!payload.membershipPlans || !Array.isArray(payload.membershipPlans)) {
      throw new Error(
        'Faltan datos requeridos: membershipPlans es obligatorio y debe ser un array',
      );
    }

    this.logger.log(
      `📊 Total de planes de membresía a migrar: ${payload.membershipPlans.length}`,
    );

    const validation =
      this.membershipPlanMigrationService.validateMembershipPlanData(
        payload.membershipPlans,
      );

    if (!validation.valid) {
      throw new Error(
        `Datos de planes de membresía inválidos: ${validation.errors.join(', ')}`,
      );
    }

    const result =
      await this.membershipPlanMigrationService.migrateMembershipPlans(
        payload.membershipPlans,
      );

    return result;
  }
}
