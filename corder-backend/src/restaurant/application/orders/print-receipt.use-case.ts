import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { TableEntity } from '../../domain/table.entity';
import { RestaurantStaffEntity } from '../../domain/restaurant-staff.entity';
import { PrintJobEntity } from '../../domain/print-job.entity';
import { OrderStatusPolicy } from '../../domain/services/order-status.policy';
import { PrintReceiptDto } from '../../api/dto/print-receipt.dto';
import { OrdersGateway } from '../../api/orders.gateway';
import { OrderQueryService } from './order-query.service';

export interface ReceiptLineItem {
  productName: string;
  quantity: number;
  price: number;
  note?: string;
  productId?: string;
  categoryId?: string;
}

interface ResolvedReceiptData {
  tableName: string;
  waiterName: string;
  items: ReceiptLineItem[];
  total: number;
}

@Injectable()
export class PrintReceiptUseCase {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(TableEntity)
    private readonly tableRepo: Repository<TableEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    @InjectRepository(PrintJobEntity)
    private readonly printJobRepo: Repository<PrintJobEntity>,
    private readonly ordersGateway: OrdersGateway,
    private readonly orderQuery: OrderQueryService,
  ) {}

  private aggregateConsolidatedReceiptLines(lines: ReceiptLineItem[]): ReceiptLineItem[] {
    const map = new Map<string, ReceiptLineItem>();
    for (const raw of lines) {
      const name = (raw.productName || '').trim() || 'Item';
      const price = Number(raw.price) || 0;
      const key = `${name}\u0000${price}`;
      const qty = Number(raw.quantity) || 0;
      if (qty <= 0) continue;
      const cur = map.get(key);
      if (cur) {
        cur.quantity += qty;
      } else {
        map.set(key, {
          productName: name,
          quantity: qty,
          price,
          productId: raw.productId,
          categoryId: raw.categoryId,
        });
      }
    }
    return [...map.values()];
  }

  private async resolveSingleOrderReceipt(
    restaurantId: string,
    orderId: string,
  ): Promise<ResolvedReceiptData> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, restaurantId, status: In(['active', 'closed']) },
      relations: ['items', 'table'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const tableName = order.table?.name ?? '-';
    const rawItems =
      order.items?.filter((i) => OrderStatusPolicy.isItemOnActiveBill(i.status)) ?? [];
    const items: ReceiptLineItem[] = rawItems.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      price: Number(i.price),
      note: i.note ?? undefined,
      productId: i.productId,
    }));
    await this.orderQuery.attachCategoryIdsToItems(items, restaurantId);
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const waiter = order.userId
      ? await this.staffRepo.findOne({ where: { id: order.userId, restaurantId } })
      : null;
    const waiterName =
      (order.userDisplayName && order.userDisplayName.trim()) || waiter?.name?.trim() || '-';
    return { tableName, waiterName, items, total };
  }

  private async resolveTableReceipt(
    restaurantId: string,
    tableId: string,
    receiptMode: 'consolidated' | 'split',
  ): Promise<ResolvedReceiptData> {
    const orders = await this.orderQuery.loadActiveOrdersEntities(restaurantId, tableId);
    if (!orders.length) {
      throw new BadRequestException('No active orders found on this table');
    }
    const table = await this.tableRepo.findOne({ where: { id: tableId, restaurantId } });
    const tableName = table?.name ?? tableId;
    const flat = orders.flatMap((o) =>
      o.items.filter((i) => OrderStatusPolicy.isItemOnActiveBill(i.status)),
    );
    let items: ReceiptLineItem[] = flat.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      price: Number(i.price),
      note: i.note ?? undefined,
      productId: i.productId,
    }));
    await this.orderQuery.attachCategoryIdsToItems(items, restaurantId);
    if (receiptMode === 'consolidated') {
      items = this.aggregateConsolidatedReceiptLines(items);
    }
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const firstWithUser = orders.find((ord) => ord.userId);
    const firstUserId = firstWithUser?.userId;
    const waiter = firstUserId
      ? await this.staffRepo.findOne({ where: { id: firstUserId, restaurantId } })
      : null;
    const waiterName =
      (firstWithUser?.userDisplayName && firstWithUser.userDisplayName.trim()) ||
      waiter?.name?.trim() ||
      '-';
    return { tableName, waiterName, items, total };
  }

  private async resolveCustomReceipt(
    restaurantId: string,
    dto: PrintReceiptDto,
    receiptMode: 'consolidated' | 'split',
  ): Promise<ResolvedReceiptData> {
    if (!dto.tableName?.trim() || !dto.items?.length || dto.total === undefined) {
      throw new BadRequestException(
        'tableName, items, and total are required when tableId is not provided',
      );
    }
    const tableName = dto.tableName.trim();
    const waiterName = dto.waiterName?.trim() || '-';
    let items: ReceiptLineItem[] = dto.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      price: i.price,
      note: i.note,
      productId: i.productId,
      categoryId: i.categoryId,
    }));
    await this.orderQuery.attachCategoryIdsToItems(items, restaurantId);
    if (receiptMode === 'consolidated') {
      items = this.aggregateConsolidatedReceiptLines(items);
    }
    const computedFromLines = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const total =
      dto.total !== undefined && dto.total !== null ? Number(dto.total) : computedFromLines;
    return { tableName, waiterName, items, total };
  }

  async execute(
    restaurantId: string,
    dto: PrintReceiptDto,
  ): Promise<{ ok: true; jobId: string }> {
    const jobId = randomUUID();
    const createdAt = new Date().toISOString();
    const receiptMode = dto.receiptMode ?? 'split';

    const resolved = dto.orderId
      ? await this.resolveSingleOrderReceipt(restaurantId, dto.orderId)
      : dto.tableId
        ? await this.resolveTableReceipt(restaurantId, dto.tableId, receiptMode)
        : await this.resolveCustomReceipt(restaurantId, dto, receiptMode);

    const includeLineNotes = receiptMode === 'split' || Boolean(dto.orderId);
    const receiptPayload = {
      type: 'order.print_job' as const,
      jobId,
      restaurantId,
      printType: 'receipt' as const,
      createdAt,
      receiptMode,
      includeLineNotes,
      order: {
        tableName: resolved.tableName,
        waiterName: resolved.waiterName,
        items: resolved.items,
        total: resolved.total,
      },
    };
    await this.printJobRepo.save(
      this.printJobRepo.create({
        id: jobId,
        restaurantId,
        printType: 'receipt',
        payload: receiptPayload as unknown as Record<string, unknown>,
        printedAt: null,
      }),
    );
    this.ordersGateway.emitPrintJob(restaurantId, receiptPayload);

    return { ok: true, jobId };
  }
}
