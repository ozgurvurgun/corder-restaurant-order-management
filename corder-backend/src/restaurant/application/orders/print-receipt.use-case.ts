import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { OrderEntity } from '../../domain/order.entity';
import { TableEntity, TableDiscountState } from '../../domain/table.entity';
import { RestaurantStaffEntity } from '../../domain/restaurant-staff.entity';
import { CompletedOrderEntity } from '../../domain/completed-order.entity';
import { PrintJobEntity } from '../../domain/print-job.entity';
import { OrderStatusPolicy } from '../../domain/services/order-status.policy';
import { PrintReceiptDto } from '../../api/dto/print-receipt.dto';
import { OrdersGateway, PrintJobSocketPayload } from '../../api/orders.gateway';
import { OrderQueryService } from './order-query.service';
import { fromMinorUnits, toMinorUnits } from '../../../common/money/minor-units';

export interface ReceiptLineItem {
  productName: string;
  quantity: number;
  price: number;
  note?: string;
  productId?: string;
  categoryId?: string;
}

interface ResolvedReceiptData {
  tableId?: string;
  orderId?: string;
  completedOrderId?: string;
  tableName: string;
  waiterName: string;
  items: ReceiptLineItem[];
  subtotal: number;
  discountAmount?: number;
  discountLabel?: string;
  tipAmount?: number;
  total: number;
  paymentMethod?: string;
  isReprint: boolean;
  earliestOrderCreatedAt?: Date;
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
    @InjectRepository(CompletedOrderEntity)
    private readonly completedOrderRepo: Repository<CompletedOrderEntity>,
    @InjectRepository(PrintJobEntity)
    private readonly printJobRepo: Repository<PrintJobEntity>,
    private readonly ordersGateway: OrdersGateway,
    private readonly orderQuery: OrderQueryService,
  ) {}

  private aggregateConsolidatedReceiptLines(lines: ReceiptLineItem[]): ReceiptLineItem[] {
    const map = new Map<string, ReceiptLineItem>();
    for (const raw of lines) {
      const name = (raw.productName || '').trim() || 'Ürün';
      const price = fromMinorUnits(toMinorUnits(Number(raw.price) || 0));
      const key = `${name}\u0000${toMinorUnits(price)}`;
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

  private sumLinesMinorUnits(items: ReceiptLineItem[]): number {
    let sumMinor = 0;
    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      if (qty <= 0) continue;
      sumMinor += toMinorUnits(Number(item.price) || 0) * qty;
    }
    return Math.max(0, sumMinor);
  }

  private computeTableDiscount(
    rawSubtotalMinor: number,
    discount: TableDiscountState | null | undefined,
  ): { discountMinor: number; discountLabel?: string; netMinor: number } {
    if (!discount || rawSubtotalMinor <= 0) {
      return { discountMinor: 0, netMinor: rawSubtotalMinor };
    }
    const reasonSuffix = discount.reason?.trim() ? ` (${discount.reason.trim()})` : '';
    if (
      discount.type === 'complimentary' ||
      (discount.type === 'percent' && Number(discount.value) >= 100)
    ) {
      return {
        discountMinor: rawSubtotalMinor,
        discountLabel: `İkram %100${reasonSuffix}`,
        netMinor: 0,
      };
    }
    if (discount.type === 'percent' && Number(discount.value) > 0) {
      const pct = Math.min(100, Math.max(0, Number(discount.value)));
      const discountMinor = Math.min(rawSubtotalMinor, Math.round((rawSubtotalMinor * pct) / 100));
      return {
        discountMinor,
        discountLabel: `%${pct} İndirim${reasonSuffix}`,
        netMinor: Math.max(0, rawSubtotalMinor - discountMinor),
      };
    }
    if (discount.type === 'amount' && Number(discount.value) > 0) {
      const discountMinor = Math.min(rawSubtotalMinor, toMinorUnits(Number(discount.value)));
      return {
        discountMinor,
        discountLabel: `İndirim${reasonSuffix}`,
        netMinor: Math.max(0, rawSubtotalMinor - discountMinor),
      };
    }
    return { discountMinor: 0, netMinor: rawSubtotalMinor };
  }

  private async resolveCompletedOrderReceipt(
    restaurantId: string,
    completedOrder: CompletedOrderEntity,
    receiptMode: 'consolidated' | 'split',
  ): Promise<ResolvedReceiptData> {
    const rawSnapshots = Array.isArray(completedOrder.ordersSnapshot)
      ? (completedOrder.ordersSnapshot as Array<Record<string, unknown>>)
      : [];
    const extracted: ReceiptLineItem[] = [];
    for (const snap of rawSnapshots) {
      const snapItems = Array.isArray(snap?.items)
        ? (snap.items as Array<Record<string, unknown>>)
        : [];
      for (const rawItem of snapItems) {
        const status = typeof rawItem.status === 'string' ? rawItem.status : 'served';
        if (!OrderStatusPolicy.isItemOnActiveBill(status)) continue;
        const quantity = Number(rawItem.quantity) || 0;
        if (quantity <= 0) continue;
        extracted.push({
          productName: String(rawItem.productName || rawItem.name || 'Ürün').trim(),
          quantity,
          price: fromMinorUnits(toMinorUnits(Number(rawItem.price) || 0)),
          note: typeof rawItem.note === 'string' && rawItem.note.trim() ? rawItem.note.trim() : undefined,
          productId: typeof rawItem.productId === 'string' ? rawItem.productId : undefined,
        });
      }
    }
    if (!extracted.length) {
      throw new BadRequestException('No billable items found on this completed order');
    }
    await this.orderQuery.attachCategoryIdsToItems(extracted, restaurantId);
    const items =
      receiptMode === 'consolidated'
        ? this.aggregateConsolidatedReceiptLines(extracted)
        : extracted;

    const lineSubtotalMinor = this.sumLinesMinorUnits(items);
    const totalMinor = toMinorUnits(Number(completedOrder.totalAmount ?? fromMinorUnits(lineSubtotalMinor)));
    const discountMinor = Math.max(0, toMinorUnits(Number(completedOrder.discountAmount ?? 0)));
    const tipMinor = Math.max(0, toMinorUnits(Number(completedOrder.paymentTip ?? 0)));
    const netMinor = Math.max(0, toMinorUnits(Number(completedOrder.netAmount ?? fromMinorUnits(totalMinor - discountMinor))));

    return {
      completedOrderId: completedOrder.id,
      tableName: (completedOrder.tableName || '').trim() || '-',
      waiterName: (completedOrder.waiter || '').trim() || '-',
      items,
      subtotal: fromMinorUnits(totalMinor > 0 ? totalMinor : lineSubtotalMinor),
      ...(discountMinor > 0 ? { discountAmount: fromMinorUnits(discountMinor) } : {}),
      ...(tipMinor > 0 ? { tipAmount: fromMinorUnits(tipMinor) } : {}),
      total: fromMinorUnits(netMinor),
      paymentMethod: completedOrder.paymentMethod || undefined,
      isReprint: true,
    };
  }

  private async resolveSingleOrderReceipt(
    restaurantId: string,
    orderId: string,
    receiptMode: 'consolidated' | 'split',
  ): Promise<ResolvedReceiptData> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, restaurantId, status: In(['active', 'closed']) },
      relations: ['items', 'table'],
    });
    if (!order) {
      const completed = await this.completedOrderRepo.findOne({
        where: { id: orderId, restaurantId },
      });
      if (completed) {
        return this.resolveCompletedOrderReceipt(restaurantId, completed, receiptMode);
      }
      throw new NotFoundException('Order not found');
    }
    const tableName = order.table?.name ?? '-';
    const rawItems =
      order.items?.filter((i) => OrderStatusPolicy.isItemOnActiveBill(i.status)) ?? [];
    const items: ReceiptLineItem[] = rawItems.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      price: fromMinorUnits(toMinorUnits(Number(i.price))),
      note: i.note ?? undefined,
      productId: i.productId,
    }));
    if (!items.length) {
      throw new BadRequestException('No billable items found on this order');
    }
    await this.orderQuery.attachCategoryIdsToItems(items, restaurantId);
    const subtotalMinor = this.sumLinesMinorUnits(items);
    const total = fromMinorUnits(subtotalMinor);
    const waiter = order.userId
      ? await this.staffRepo.findOne({ where: { id: order.userId, restaurantId } })
      : null;
    const waiterName =
      (order.userDisplayName && order.userDisplayName.trim()) || waiter?.name?.trim() || '-';
    return {
      orderId: order.id,
      tableId: order.tableId,
      tableName,
      waiterName,
      items,
      subtotal: total,
      total,
      isReprint: order.status === 'closed',
      earliestOrderCreatedAt: order.createdAt,
    };
  }

  private async resolveTableReceipt(
    restaurantId: string,
    tableId: string,
    receiptMode: 'consolidated' | 'split',
  ): Promise<ResolvedReceiptData> {
    const table = await this.tableRepo.findOne({ where: { id: tableId, restaurantId } });
    const orders = await this.orderQuery.loadActiveOrdersEntities(restaurantId, tableId);
    if (!orders.length) {
      if (table?.name) {
        const recentCompleted = await this.completedOrderRepo.findOne({
          where: {
            restaurantId,
            tableName: table.name,
            closedAt: MoreThanOrEqual(new Date(Date.now() - 15 * 60_000)),
          },
          order: { closedAt: 'DESC' },
        });
        if (recentCompleted) {
          return this.resolveCompletedOrderReceipt(restaurantId, recentCompleted, receiptMode);
        }
      }
      throw new BadRequestException('No active orders found on this table');
    }
    const tableName = table?.name ?? tableId;
    const flat = orders.flatMap((o) =>
      o.items.filter((i) => OrderStatusPolicy.isItemOnActiveBill(i.status)),
    );
    let items: ReceiptLineItem[] = flat.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      price: fromMinorUnits(toMinorUnits(Number(i.price))),
      note: i.note ?? undefined,
      productId: i.productId,
    }));
    if (!items.length) {
      throw new BadRequestException('No active billable items found on this table');
    }
    await this.orderQuery.attachCategoryIdsToItems(items, restaurantId);
    if (receiptMode === 'consolidated') {
      items = this.aggregateConsolidatedReceiptLines(items);
    }

    const rawSubtotalMinor = this.sumLinesMinorUnits(items);
    const { discountMinor, discountLabel, netMinor } = this.computeTableDiscount(
      rawSubtotalMinor,
      table?.discount,
    );

    const firstWithUser = orders.find((ord) => ord.userId);
    const firstUserId = firstWithUser?.userId;
    const waiter = firstUserId
      ? await this.staffRepo.findOne({ where: { id: firstUserId, restaurantId } })
      : null;
    const waiterName =
      (firstWithUser?.userDisplayName && firstWithUser.userDisplayName.trim()) ||
      waiter?.name?.trim() ||
      '-';

    const earliestOrderCreatedAt = orders.reduce(
      (min, o) => (o.createdAt < min ? o.createdAt : min),
      orders[0].createdAt,
    );

    return {
      tableId,
      tableName,
      waiterName,
      items,
      subtotal: fromMinorUnits(rawSubtotalMinor),
      ...(discountMinor > 0 ? { discountAmount: fromMinorUnits(discountMinor), discountLabel } : {}),
      total: fromMinorUnits(netMinor),
      isReprint: false,
      earliestOrderCreatedAt,
    };
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
    let items: ReceiptLineItem[] = dto.items
      .filter((i) => Number(i.quantity) > 0)
      .map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        price: fromMinorUnits(toMinorUnits(Number(i.price) || 0)),
        note: i.note,
        productId: i.productId,
        categoryId: i.categoryId,
      }));
    if (!items.length) {
      throw new BadRequestException('Receipt must contain at least one billable item');
    }
    await this.orderQuery.attachCategoryIdsToItems(items, restaurantId);
    if (receiptMode === 'consolidated') {
      items = this.aggregateConsolidatedReceiptLines(items);
    }
    const computedMinor = this.sumLinesMinorUnits(items);
    const subtotalMinor = computedMinor;
    const requestedTotalMinor =
      dto.total !== undefined && dto.total !== null
        ? Math.max(0, toMinorUnits(Number(dto.total)))
        : subtotalMinor;
    const discountMinor =
      dto.discountAmount !== undefined && dto.discountAmount !== null
        ? Math.min(subtotalMinor, Math.max(0, toMinorUnits(Number(dto.discountAmount))))
        : requestedTotalMinor < subtotalMinor
          ? subtotalMinor - requestedTotalMinor
          : 0;
    const tipMinor =
      dto.tipAmount !== undefined && dto.tipAmount !== null
        ? Math.max(0, toMinorUnits(Number(dto.tipAmount)))
        : 0;
    const totalMinor = Math.max(0, subtotalMinor - discountMinor);

    return {
      tableName,
      waiterName,
      items,
      subtotal: fromMinorUnits(subtotalMinor),
      ...(discountMinor > 0
        ? {
            discountAmount: fromMinorUnits(discountMinor),
            discountLabel: dto.discountLabel?.trim() || 'İndirim',
          }
        : {}),
      ...(tipMinor > 0 ? { tipAmount: fromMinorUnits(tipMinor) } : {}),
      total: fromMinorUnits(totalMinor),
      paymentMethod: dto.paymentMethod?.trim() || undefined,
      isReprint: Boolean(dto.isReprint),
    };
  }

  private async detectPreviousReceiptPrint(
    restaurantId: string,
    resolved: ResolvedReceiptData,
  ): Promise<boolean> {
    if (resolved.isReprint) return true;
    if (!resolved.orderId && !resolved.tableId && !resolved.completedOrderId) return false;

    const since = resolved.earliestOrderCreatedAt ?? new Date(Date.now() - 12 * 3600_000);
    const recentJobs = await this.printJobRepo.find({
      where: {
        restaurantId,
        printType: 'receipt',
        createdAt: MoreThanOrEqual(since),
      },
      order: { createdAt: 'DESC' },
      take: 40,
    });

    for (const job of recentJobs) {
      const orderObj = (job.payload as Record<string, unknown> | undefined)?.order as
        | Record<string, unknown>
        | undefined;
      if (!orderObj) continue;
      if (resolved.orderId && orderObj.orderId === resolved.orderId) return true;
      if (resolved.completedOrderId && orderObj.completedOrderId === resolved.completedOrderId) {
        return true;
      }
      if (resolved.tableId && orderObj.tableId === resolved.tableId) return true;
    }
    return false;
  }

  async execute(
    restaurantId: string,
    dto: PrintReceiptDto,
  ): Promise<{ ok: true; jobId: string }> {
    const jobId = randomUUID();
    const createdAt = new Date().toISOString();
    const receiptMode = dto.receiptMode ?? 'split';

    let resolved: ResolvedReceiptData;
    if (dto.completedOrderId) {
      const completed = await this.completedOrderRepo.findOne({
        where: { id: dto.completedOrderId, restaurantId },
      });
      if (!completed) throw new NotFoundException('Completed order not found');
      resolved = await this.resolveCompletedOrderReceipt(restaurantId, completed, receiptMode);
    } else if (dto.orderId) {
      resolved = await this.resolveSingleOrderReceipt(restaurantId, dto.orderId, receiptMode);
    } else if (dto.tableId) {
      resolved = await this.resolveTableReceipt(restaurantId, dto.tableId, receiptMode);
    } else {
      resolved = await this.resolveCustomReceipt(restaurantId, dto, receiptMode);
    }

    const isReprint =
      dto.isReprint !== undefined
        ? Boolean(dto.isReprint)
        : await this.detectPreviousReceiptPrint(restaurantId, resolved);
    const paymentMethod = dto.paymentMethod?.trim() || resolved.paymentMethod;
    const openCashDrawer =
      dto.openCashDrawer !== undefined
        ? Boolean(dto.openCashDrawer)
        : Boolean(paymentMethod === 'cash' && !isReprint);

    const includeLineNotes = receiptMode === 'split' || Boolean(dto.orderId);
    const receiptPayload: PrintJobSocketPayload = {
      type: 'order.print_job',
      jobId,
      restaurantId,
      printType: 'receipt',
      createdAt,
      receiptMode,
      includeLineNotes,
      isReprint,
      openCashDrawer,
      order: {
        ...(resolved.tableId ? { tableId: resolved.tableId } : {}),
        ...(resolved.orderId ? { orderId: resolved.orderId } : {}),
        ...(resolved.completedOrderId ? { completedOrderId: resolved.completedOrderId } : {}),
        tableName: resolved.tableName,
        waiterName: resolved.waiterName,
        ...(paymentMethod ? { paymentMethod } : {}),
        subtotal: resolved.subtotal,
        ...(resolved.discountAmount && resolved.discountAmount > 0
          ? {
              discountAmount: resolved.discountAmount,
              ...(resolved.discountLabel ? { discountLabel: resolved.discountLabel } : {}),
            }
          : {}),
        ...(resolved.tipAmount && resolved.tipAmount > 0 ? { tipAmount: resolved.tipAmount } : {}),
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

