import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Membership } from 'src/membership/entities/membership.entity';
import { Repository } from 'typeorm';
import { CreateReconsumptionDto } from '../dto/create-membership-reconsumtion.dto';
import { MembershipReconsumption } from '../entities/membership-reconsumption.entity';
import { BaseReconsumptionService } from './base-reconsumption.service';

@Injectable()
export class PointsReconsumptionService extends BaseReconsumptionService {
  protected readonly logger = new Logger(PointsReconsumptionService.name);

  constructor(
    @InjectRepository(MembershipReconsumption)
    reconsumptionRepository: Repository<MembershipReconsumption>,
    @InjectRepository(Membership)
    membershipRepository: Repository<Membership>,
  ) {
    super(reconsumptionRepository, membershipRepository);
  }

  processReconsumption(
    userId: string,
    _createDto: CreateReconsumptionDto,
    _files?: Array<{
      originalname: string;
      buffer: Buffer;
      mimetype: string;
      size: number;
    }>,
  ): Promise<any> {
    this.logger.log(`Reconsumo con POINTS solicitado para usuario ${userId}`);

    // Implementación futura
    throw new RpcException({
      status: HttpStatus.NOT_IMPLEMENTED,
      message: 'El método de pago POINTS estará disponible próximamente',
    });
  }
}
