import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutomaticReconsumptionService } from './cuts/automatic-reconsumption.service';
import { WeeklyVolumeProcessingService } from './cuts/weekly-volume-processing.service';

@Injectable()
export class CutSchedulerService {
  private readonly logger = new Logger(CutSchedulerService.name);

  constructor(
    private readonly automaticReconsumptionService: AutomaticReconsumptionService,
    private readonly weeklyVolumeProcessingService: WeeklyVolumeProcessingService,
  ) {}

  // Ejecuta a las 3:00 AM todos los días (hora de Lima GMT-5)
  @Cron('40 20 * * *', {
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

  // Ejecuta el procesamiento de volúmenes semanales los lunes a las 2:00 AM (hora de Lima GMT-5)
  @Cron('31 20 * * 2', {
    name: 'weekly-volume-processing',
    timeZone: 'America/Lima',
  })
  async executeWeeklyVolumeProcessing(): Promise<void> {
    this.logger.log(
      'Iniciando corte de volúmenes semanales a las 2:00 AM del lunes',
    );

    try {
      const result = await this.weeklyVolumeProcessingService.execute();
      this.logger.log(
        `Corte de volúmenes semanales completado exitosamente: ${result.processed} procesados, ${result.successful} exitosos, ${result.totalPoints} puntos otorgados`,
      );
    } catch (error) {
      this.logger.error(
        'Error ejecutando corte de volúmenes semanales:',
        error.stack,
      );
    }
  }
}
