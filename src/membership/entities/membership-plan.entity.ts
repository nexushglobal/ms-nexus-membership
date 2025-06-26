import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Membership } from './membership.entity';

@Entity('membership_plans')
@Index(['isActive', 'displayOrder'])
export class MembershipPlan {
  @PrimaryColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  price: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  checkAmount: number;

  @Column({ type: 'int' })
  binaryPoints: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  commissionPercentage: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => (value ? parseFloat(value) : null),
    },
  })
  directCommissionAmount?: number;

  @Column('text', { array: true, default: [] })
  products: string[];

  @Column('text', { array: true, default: [] })
  benefits: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0, name: 'display_order' })
  displayOrder: number;

  @OneToMany(() => Membership, (membership) => membership.plan)
  memberships: Membership[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  trimAndValidate() {
    if (this.name) {
      this.name = this.name.trim();
    }

    // Limpiar arrays de elementos vacíos
    if (this.products) {
      this.products = this.products
        .filter((product) => product && product.trim().length > 0)
        .map((product) => product.trim());
    }

    if (this.benefits) {
      this.benefits = this.benefits
        .filter((benefit) => benefit && benefit.trim().length > 0)
        .map((benefit) => benefit.trim());
    }

    // Validaciones básicas
    if (this.price < 0) {
      throw new Error('El precio no puede ser negativo');
    }

    if (this.checkAmount < 0) {
      throw new Error('El monto de cheque no puede ser negativo');
    }

    if (this.binaryPoints < 0) {
      throw new Error('Los puntos binarios no pueden ser negativos');
    }

    if (this.commissionPercentage < 0 || this.commissionPercentage > 100) {
      throw new Error('El porcentaje de comisión debe estar entre 0 y 100');
    }
  }
}
