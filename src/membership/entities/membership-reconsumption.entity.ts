import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Membership } from './membership.entity';

export enum ReconsumptionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  CANCELLED = 'CANCELLED',
}

@Entity('membership_reconsumptions')
@Index(['membership', 'periodDate'])
@Index(['status', 'periodDate'])
export class MembershipReconsumption {
  @PrimaryColumn()
  id: number;

  @ManyToOne(() => Membership, (membership) => membership.reconsumptions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'membership_id' })
  membership: Membership;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  amount: number;

  @Column({
    type: 'enum',
    enum: ReconsumptionStatus,
    default: ReconsumptionStatus.PENDING,
  })
  status: ReconsumptionStatus;

  @Column({ type: 'date', name: 'period_date' })
  periodDate: Date;

  @Column({ nullable: true, name: 'payment_reference' })
  paymentReference?: string;

  @Column({ type: 'json', nullable: true, name: 'payment_details' })
  paymentDetails?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  validate() {
    if (this.amount < 0) {
      throw new Error('El monto no puede ser negativo');
    }

    if (this.paymentReference) {
      this.paymentReference = this.paymentReference.trim();
    }

    if (this.notes) {
      this.notes = this.notes.trim();
    }
  }
}
