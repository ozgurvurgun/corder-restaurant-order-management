import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from '../api/dto/create-order.dto';
import { CloseCheckDto } from '../api/dto/close-check.dto';
import { PrintReceiptDto } from '../api/dto/print-receipt.dto';
import { OrderQueryService } from './orders/order-query.service';
import { CreateOrderUseCase } from './orders/create-order.use-case';
import {
  MoveItemsToTableInput,
  TransferOrderUseCase,
} from './orders/transfer-order.use-case';
import { CancelOrderItemUseCase } from './orders/cancel-order-item.use-case';
import { OrderLedgerUseCase } from './orders/order-ledger.use-case';
import { CloseCheckUseCase } from './orders/close-check.use-case';
import { PrintReceiptUseCase } from './orders/print-receipt.use-case';
import { SettlementActorPolicy } from '../domain/services/check-settlement.policy';

/**
 * Application Facade coordinating order queries and command use cases.
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly orderQuery: OrderQueryService,
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly transferOrderUseCase: TransferOrderUseCase,
    private readonly cancelOrderItemUseCase: CancelOrderItemUseCase,
    private readonly orderLedgerUseCase: OrderLedgerUseCase,
    private readonly closeCheckUseCase: CloseCheckUseCase,
    private readonly printReceiptUseCase: PrintReceiptUseCase,
  ) {}

  findByRestaurant(
    restaurantId: string,
    tableId?: string,
  ): Promise<Record<string, unknown>[]> {
    return this.orderQuery.findByRestaurant(restaurantId, tableId);
  }

  findOne(id: string, restaurantId: string): Promise<Record<string, unknown>> {
    return this.orderQuery.findOne(id, restaurantId);
  }

  create(
    restaurantId: string,
    dto: CreateOrderDto,
    actor?: { staffId?: string | null; displayName?: string | null },
  ): Promise<Record<string, unknown>> {
    return this.createOrderUseCase.execute(restaurantId, dto, actor);
  }

  moveTable(
    restaurantId: string,
    fromTableId: string,
    toTableId: string,
    actorStaffId?: string | null,
  ): Promise<{ moved: number }> {
    return this.transferOrderUseCase.moveTable(
      restaurantId,
      fromTableId,
      toTableId,
      actorStaffId,
    );
  }

  moveItemsToTable(
    restaurantId: string,
    dto: MoveItemsToTableInput,
  ): Promise<Record<string, unknown>> {
    return this.transferOrderUseCase.moveItemsToTable(restaurantId, dto);
  }

  closeCheck(
    restaurantId: string,
    dto: CloseCheckDto,
    actor: { id: string; name: string } & SettlementActorPolicy,
  ) {
    return this.closeCheckUseCase.execute(restaurantId, dto, actor);
  }

  cancelOrderItem(
    restaurantId: string,
    itemId: string,
    reason?: string,
    cancelledByName?: string,
    actorStaffId?: string | null,
    quantity?: number | null,
  ): Promise<{ ok: true }> {
    return this.cancelOrderItemUseCase.execute(
      restaurantId,
      itemId,
      reason,
      cancelledByName,
      actorStaffId,
      quantity,
    );
  }

  printReceipt(
    restaurantId: string,
    dto: PrintReceiptDto,
  ): Promise<{ ok: true; jobId: string }> {
    return this.printReceiptUseCase.execute(restaurantId, dto);
  }

  assignItemsToLedger(
    restaurantId: string,
    lines: { itemId: string; quantity?: number }[],
    ledgerCustomerId: string,
    staffName: string,
  ): Promise<{ ok: true; amount: number }> {
    return this.orderLedgerUseCase.assignItemsToLedger(
      restaurantId,
      lines,
      ledgerCustomerId,
      staffName,
    );
  }

  revertLedgerOrderItem(
    restaurantId: string,
    itemId: string,
    actorName: string,
  ): Promise<{ ok: true; amount: number }> {
    return this.orderLedgerUseCase.revertLedgerOrderItem(restaurantId, itemId, actorName);
  }

  findPendingKitchenPrints(restaurantId: string): Promise<Record<string, unknown>[]> {
    return this.orderQuery.findPendingKitchenOrdersForPrintAgent(restaurantId);
  }

  markKitchenTicketPrinted(
    restaurantId: string,
    orderId: string,
  ): Promise<{ ok: true }> {
    return this.orderQuery.markKitchenTicketPrinted(restaurantId, orderId);
  }

  findPendingPrintJobs(restaurantId: string): Promise<Record<string, unknown>[]> {
    return this.orderQuery.findPendingPrintJobsForPrintAgent(restaurantId);
  }

  markPrintJobPrinted(restaurantId: string, jobId: string): Promise<{ ok: true }> {
    return this.orderQuery.markPrintJobPrinted(restaurantId, jobId);
  }
}
