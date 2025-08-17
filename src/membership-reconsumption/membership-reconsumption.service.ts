import {
  forwardRef,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentMethod } from 'src/common/enums/payment-method.enum';
import { BaseService } from 'src/common/services/base.service';
import { MembershipStatus } from 'src/membership/entities/membership.entity';
import { MembershipService } from 'src/membership/services/membership.service';
import { Repository } from 'typeorm';
import { CreateReconsumptionPayload } from './dto/create-membership-reconsumtion.dto';
import {
  FindByMembershipIdDto,
  FindByMembershipIdResponseDto,
} from './dto/find-by-membership-id.dto';
import {
  MembershipReconsumption,
  ReconsumptionStatus,
} from './entities/membership-reconsumption.entity';
import { PaymentGatewayReconsumptionService } from './services/payment-gateway-reconsumption.service';
import { PointsReconsumptionService } from './services/points-reconsumption.service';
import { VoucherReconsumptionService } from './services/voucher-reconsumption.service';

@Injectable()
export class MembershipReconsumptionService extends BaseService<MembershipReconsumption> {
  private readonly logger = new Logger(MembershipReconsumptionService.name);

  constructor(
    @InjectRepository(MembershipReconsumption)
    private readonly membershipReconsumptionRepository: Repository<MembershipReconsumption>,
    @Inject(forwardRef(() => MembershipService))
    private readonly membershipService: MembershipService,
    private readonly voucherReconsumptionService: VoucherReconsumptionService,
    private readonly pointsReconsumptionService: PointsReconsumptionService,
    private readonly paymentGatewayReconsumptionService: PaymentGatewayReconsumptionService,
  ) {
    super(membershipReconsumptionRepository);
  }

  async findByMembershipId(
    data: FindByMembershipIdDto,
  ): Promise<FindByMembershipIdResponseDto> {
    const { userId, ...paginationDto } = data;
    const membership = await this.membershipService.findOneByUserId(userId);
    const queryBuilder = await this.membershipReconsumptionRepository
      .createQueryBuilder('reconsumption')
      .leftJoinAndSelect('reconsumption.membership', 'membership')
      .where('membership.id = :membershipId', { membershipId: membership.id })
      .orderBy('reconsumption.createdAt', 'DESC')

      .getMany();
    const pendingReconsumption =
      await this.membershipReconsumptionRepository.findOne({
        where: {
          membership: { id: membership.id },
          status: ReconsumptionStatus.PENDING,
        },
      });
    const nextReconsumptionDate = new Date(membership.endDate);
    const canReconsume =
      !pendingReconsumption && new Date() >= nextReconsumptionDate;
    const autoRenewal = membership.autoRenewal;
    const reconsumptionAmount = membership.minimumReconsumptionAmount;
    const infoReconsumptions = await this.findAllBase(
      queryBuilder,
      paginationDto,
    );

    return {
      infoReconsumptions,
      membership: {
        useCard: membership.useCard,
        isPointLot: membership.isPointLot,
        status: membership.status,
        canReconsume,
        autoRenewal,
        reconsumptionAmount,
        startDate: membership.startDate,
        endDate: membership.endDate,
      },
    };
  }

  async findOneLastReconsumption(
    membershipId: number,
  ): Promise<MembershipReconsumption | null> {
    const lastReconsumption =
      await this.membershipReconsumptionRepository.findOne({
        where: { membership: { id: membershipId } },
        order: { periodDate: 'DESC' },
      });
    return lastReconsumption;
  }

  async pendingReconsumption(
    membershipId: number,
  ): Promise<MembershipReconsumption | null> {
    const pendingReconsumption =
      await this.membershipReconsumptionRepository.findOne({
        where: {
          membership: { id: membershipId },
          status: ReconsumptionStatus.PENDING,
        },
      });
    return pendingReconsumption;
  }

  async createReconsumption(data: CreateReconsumptionPayload): Promise<any> {
    this.logger.log(
      `Creando reconsumo para usuario ${data.userId} con método ${data.dto.paymentMethod}`,
    );

    // Validar método de pago
    if (!Object.values(PaymentMethod).includes(data.dto.paymentMethod)) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Método de pago no válido',
      });
    }

    try {
      // 1. Validar que el usuario pueda hacer reconsumo
      await this.validateReconsumptionEligibility(data.userId);

      // 2. Procesar según el método de pago
      switch (data.dto.paymentMethod) {
        case PaymentMethod.VOUCHER:
          if (!data.dto.payments || data.dto.payments.length === 0) {
            throw new RpcException({
              status: HttpStatus.BAD_REQUEST,
              message:
                'Para el método VOUCHER se requieren los detalles de pago',
            });
          }
          return await this.voucherReconsumptionService.processReconsumption(
            data.userId,
            data.dto,
            data.files,
          );

        case PaymentMethod.POINTS:
          // Implementación futura
          return await this.pointsReconsumptionService.processReconsumption(
            data.userId,
            data.dto,
            data.files,
          );

        case PaymentMethod.PAYMENT_GATEWAY:
          if (!data.dto.source_id) {
            throw new RpcException({
              status: HttpStatus.BAD_REQUEST,
              message:
                'Para el método PAYMENT_GATEWAY se requiere el source_id',
            });
          }
          return await this.paymentGatewayReconsumptionService.processReconsumption(
            data.userId,
            data.dto,
          );

        default:
          throw new RpcException({
            status: HttpStatus.BAD_REQUEST,
            message: 'Método de pago no soportado',
          });
      }
    } catch (error) {
      this.logger.error(`Error al crear reconsumo: ${error.message}`);
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al procesar el reconsumo',
      });
    }
  }

  /**
   * Valida si el usuario es elegible para hacer un reconsumo
   */
  private async validateReconsumptionEligibility(
    userId: string,
  ): Promise<void> {
    // 1. Verificar que el usuario tenga una membresía
    const membership = await this.membershipService.findOneByUserId(userId);
    if (!membership) {
      throw new RpcException({
        status: HttpStatus.NOT_FOUND,
        message: 'El usuario no tiene una membresía activa',
      });
    }

    // 2. Verificar que no tenga un reconsumo pendiente
    const pendingReconsumption = await this.pendingReconsumption(membership.id);
    if (pendingReconsumption) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Ya tienes un reconsumo pendiente',
      });
    }

    // 3. Validar estado de la membresía y fechas
    const currentDate = new Date();
    const sevenDaysBeforeExpiration = new Date(membership.endDate);
    sevenDaysBeforeExpiration.setDate(sevenDaysBeforeExpiration.getDate() - 7);

    // Si la membresía está activa, debe estar dentro de los 7 días antes de expirar
    if (membership.status === MembershipStatus.ACTIVE) {
      if (currentDate < sevenDaysBeforeExpiration) {
        throw new RpcException({
          status: HttpStatus.BAD_REQUEST,
          message:
            'Solo puedes hacer reconsumo 7 días antes de que expire tu membresía o después de que haya expirado',
        });
      }
    }

    // Si la membresía está pendiente, no se puede hacer reconsumo
    if (membership.status === MembershipStatus.PENDING) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message:
          'No puedes hacer reconsumo mientras tu membresía está pendiente',
      });
    }
  }
}
