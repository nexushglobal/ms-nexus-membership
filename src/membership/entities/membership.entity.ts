import { MembershipPlan } from 'src/membership-plan/entities/membership-plan.entity';
import { MembershipReconsumption } from 'src/membership-reconsumption/entities/membership-reconsumption.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MembershipStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
  DELETED = 'DELETED',
  SUSPENDED = 'SUSPENDED',
}

@Entity('memberships')
@Index(['userId', 'status'])
@Index(['status', 'endDate'])
export class Membership {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: string; // UUID del usuario desde el microservicio de usuarios

  @Column({ name: 'user_email' })
  userEmail: string; // Email para referencia rápida

  @Column({ name: 'user_name', nullable: true })
  userName?: string; // Nombre completo para referencia

  @Column({ name: 'from_plan', default: false })
  fromPlan: boolean;

  @Column({ name: 'from_plan_id', nullable: true })
  fromPlanId?: number;

  @ManyToOne(() => MembershipPlan, { nullable: false, eager: true })
  @JoinColumn({ name: 'plan_id' })
  plan: MembershipPlan;

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true, name: 'end_date' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.PENDING,
  })
  status: MembershipStatus;

  @Column({ type: 'boolean', default: false })
  useCard: boolean;

  @Column({ type: 'boolean', default: false })
  isPointLot: boolean;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 217,
    name: 'minimum_reconsumption_amount',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  minimumReconsumptionAmount: number;

  @Column({ type: 'boolean', default: false, name: 'auto_renewal' })
  autoRenewal: boolean;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(
    () => MembershipReconsumption,
    (reconsumption) => reconsumption.membership,
    { cascade: true },
  )
  reconsumptions: MembershipReconsumption[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    // Validar fechas
    if (this.startDate && this.endDate && this.endDate < this.startDate) {
      throw new Error(
        'La fecha de fin no puede ser anterior a la fecha de inicio',
      );
    }

    if (this.minimumReconsumptionAmount < 0) {
      throw new Error('El monto mínimo de reconsumo no puede ser negativo');
    }

    if (this.userEmail) {
      this.userEmail = this.userEmail.toLowerCase().trim();
    }

    if (this.userName) {
      this.userName = this.userName.trim();
    }
  }

  // Método helper para verificar si la membresía está activa
  isActive(): boolean {
    return this.status === MembershipStatus.ACTIVE;
  }

  // Método helper para verificar si la membresía ha expirado
  isExpired(): boolean {
    if (!this.endDate) return false;
    return new Date() > this.endDate;
  }

  // Método helper para obtener días restantes
  getDaysRemaining(): number | null {
    if (!this.endDate) return null;
    const today = new Date();
    const diffTime = this.endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }
}
