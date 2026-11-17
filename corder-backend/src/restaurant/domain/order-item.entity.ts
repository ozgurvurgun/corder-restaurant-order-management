import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { OrderEntity } from './order.entity';

@Entity('order_items')
@Index(['orderId'])
@Index(['orderId', 'status'])
export class OrderItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => OrderEntity, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;

  @Column({ name: 'product_id' })
  productId: string;

  @Column({ name: 'product_name' })
  productName: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ name: 'cancel_reason', type: 'varchar', length: 500, nullable: true })
  cancelReason: string | null;

  @Column({ name: 'cancelled_by', type: 'varchar', length: 255, nullable: true })
  cancelledBy: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  isBillable(): boolean {
    return this.status !== 'cancelled' && this.status !== 'ledger';
  }

  cancel(reason?: string | null, cancelledBy?: string | null, now: Date = new Date()): void {
    if (this.status === 'ledger') {
      throw new BadRequestException('Cannot cancel an order item assigned to ledger');
    }
    if (this.status === 'cancelled') {
      throw new BadRequestException('Order item is already cancelled');
    }
    this.status = 'cancelled';
    this.cancelReason = (reason ?? '').trim() || null;
    this.cancelledBy = (cancelledBy ?? '').trim() || null;
    this.cancelledAt = now;
  }

  /**
   * Resolve how many units to take from this line (cancel / move / pay).
   * Returns the taken quantity; reduces `this.quantity` when partial.
   */
  takeQuantity(requestedQuantity?: number | null): { full: boolean; quantity: number } {
    if (this.status === 'cancelled') {
      throw new BadRequestException('Order item is cancelled');
    }
    if (this.status === 'ledger') {
      throw new BadRequestException('Order item is already assigned to ledger');
    }
    const available = this.quantity;
    const reqQ =
      requestedQuantity != null && requestedQuantity !== undefined
        ? Math.floor(Number(requestedQuantity))
        : available;
    if (!Number.isInteger(reqQ) || reqQ < 1 || reqQ > available) {
      throw new BadRequestException('Invalid item quantity');
    }
    if (reqQ < available) {
      this.quantity = available - reqQ;
      return { full: false, quantity: reqQ };
    }
    return { full: true, quantity: reqQ };
  }

  assignToLedger(requestedQuantity?: number): {
    fullAssignment: boolean;
    assignedQuantity: number;
    unitPrice: number;
    lineTotal: number;
  } {
    if (this.status === 'cancelled') {
      throw new BadRequestException('Order item is cancelled');
    }
    if (this.status === 'ledger') {
      throw new BadRequestException('Order item is already assigned to ledger');
    }
    const available = this.quantity;
    const reqQ =
      requestedQuantity != null ? Math.floor(Number(requestedQuantity)) : available;
    if (!Number.isInteger(reqQ) || reqQ < 1 || reqQ > available) {
      throw new BadRequestException('Invalid item quantity');
    }
    const unitPrice = Number(this.price);
    const lineTotal = unitPrice * reqQ;
    if (reqQ < available) {
      this.quantity = available - reqQ;
      return {
        fullAssignment: false,
        assignedQuantity: reqQ,
        unitPrice,
        lineTotal,
      };
    }
    this.status = 'ledger';
    this.cancelReason = null;
    this.cancelledBy = null;
    this.cancelledAt = null;
    return {
      fullAssignment: true,
      assignedQuantity: reqQ,
      unitPrice,
      lineTotal,
    };
  }

  revertFromLedger(): void {
    if (this.status !== 'ledger') {
      throw new BadRequestException('Only ledger-assigned order items can be reverted');
    }
    this.status = 'sent';
  }
}
