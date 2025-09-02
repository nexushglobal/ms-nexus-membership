import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutomaticReconsumptionService } from './cuts/automatic-reconsumption.service';

@Injectable()
export class CutSchedulerService {
  private readonly logger = new Logger(CutSchedulerService.name);

  constructor(
    private readonly automaticReconsumptionService: AutomaticReconsumptionService,
  ) {}

  // Ejecuta a las 3:00 AM todos los días (hora de Lima GMT-5)
  @Cron('23 22 * * *', {
    name: 'automatic-reconsumption-cut',
    timeZone: 'America/Lima',
  })
  async executeAutomaticReconsumptionCut(): Promise<void> {
    this.logger.log('Iniciando corte automático de reconsumo a las 3:00 AM');

    try {
      await this.automaticReconsumptionService.execute();
      this.logger.log('Corte automático de reconsumo completado exitosamente');
    } catch (error) {
      this.logger.error(
        'Error ejecutando corte automático de reconsumo:',
        error.stack,
      );
    }
  }
}
