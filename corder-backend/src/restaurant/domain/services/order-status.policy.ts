import { BadRequestException } from '@nestjs/common';
import { OrderItemEntity } from '../order-item.entity';

export class OrderStatusPolicy {
  static isItemOnActiveBill(status: string): boolean {
    return status !== 'cancelled' && status !== 'ledger' && status !== 'paid';
  }

  static isItemPrintableForKitchen(status: string): boolean {
    return status !== 'cancelled' && status !== 'ledger';
  }

  static resolveOrderStatus(items: Array<{ status: string }>): 'active' | 'closed' {
    if (!items.length) return 'closed';
    const hasActiveLine = items.some((i) => this.isItemOnActiveBill(i.status));
    return hasActiveLine ? 'active' : 'closed';
  }

  static assertItemTransferable(
    item: OrderItemEntity,
    restaurantId: string,
    fromTableId: string,
  ): void {
    const order = item.order;
    if (!order || order.restaurantId !== restaurantId) {
      throw new BadRequestException('Invalid order item');
    }
    if (order.tableId !== fromTableId || order.status !== 'active') {
      throw new BadRequestException('Order item is not active on this table');
    }
    if (item.status === 'cancelled') {
      throw new BadRequestException('Cannot transfer a cancelled order item');
    }
    if (item.status === 'ledger') {
      throw new BadRequestException('Cannot transfer a ledger-assigned order item');
    }
    if (item.status === 'paid') {
      throw new BadRequestException('Cannot transfer an already paid order item');
    }
  }
}
