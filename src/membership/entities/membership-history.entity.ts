import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Membership } from './membership.entity';

export enum MembershipAction {
  CREATED = 'CREATED',
  UPGRADE = 'UPGRADE',
  PURCHASE = 'PURCHASE',
  RENEWED = 'RENEWED',
  CANCELLED = 'CANCELLED',
  REACTIVATED = 'REACTIVATED',
  EXPIRED = 'EXPIRED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PLAN_CHANGED = 'PLAN_CHANGED',
  RECONSUMPTION_ADDED = 'RECONSUMPTION_ADDED',
  PURCHASE = 'PURCHASE', // ✅ Agrega este
  UPGRADE = 'UPGRADE',
}

@Entity('membership_history')
@Index(['membership'])
@Index(['action', 'createdAt'])
export class MembershipHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Membership, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'membership_id' })
  membership: Membership;

  @Column({
    type: 'enum',
    enum: MembershipAction,
  })
  action: MembershipAction;

  @Column({ type: 'json', nullable: true })
  changes?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
