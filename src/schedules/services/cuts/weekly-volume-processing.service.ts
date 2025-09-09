import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PointsService } from 'src/common/services/points.service';

export interface WeeklyVolumeProcessResult {
  processed: number;
  successful: number;
  failed: number;
  totalPoints: number;
  executedAt: Date;
  summary: {
    averagePointsPerUser: number;
    successRate: number;
    totalUsersProcessed: number;
  };
}

@Injectable()
export class WeeklyVolumeProcessingService {
  private readonly logger = new Logger(WeeklyVolumeProcessingService.name);

  constructor(private readonly pointsService: PointsService) {}

  async execute(): Promise<WeeklyVolumeProcessResult> {
    this.logger.log('Iniciando procesamiento de volúmenes semanales');

    try {
      const result = await this.pointsService.processWeeklyVolumes();
      const executedAt = new Date();

      const processResult: WeeklyVolumeProcessResult = {
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        totalPoints: result.totalPoints,
        executedAt,
        summary: {
          averagePointsPerUser:
            result.successful > 0 ? result.totalPoints / result.successful : 0,
          successRate:
            result.processed > 0
              ? (result.successful / result.processed) * 100
              : 0,
          totalUsersProcessed: result.processed,
        },
      };

      this.logger.log(
        `Procesamiento de volúmenes semanales completado: ${result.processed} procesados, ${result.successful} exitosos, ${result.failed} fallidos, ${result.totalPoints} puntos totales`,
      );

      return processResult;
    } catch (error) {
      this.logger.error(
        'Error en el procesamiento de volúmenes semanales:',
        error.stack,
      );

      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error procesando volúmenes semanales',
        details: error.message,
      });
    }
  }
}
