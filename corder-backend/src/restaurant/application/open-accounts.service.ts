import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { OpenAccountEntity } from '../domain/open-account.entity';
import { OpenAccountItemEntity } from '../domain/open-account-item.entity';
import { OpenAccountPaymentEntity } from '../domain/open-account-payment.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { BilledOrderLineForStock } from '../domain/services/recipe-stock.policy';
import { StockMovementsService } from './stock-movements.service';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';
import { normalizeStorageText } from '../../common/text/text-normalizer';
import {
  CreateOpenAccountDto,
  CreateOpenAccountItemDto,
} from '../api/dto/create-open-account.dto';

export { CreateOpenAccountDto, CreateOpenAccountItemDto };

@Injectable()
export class OpenAccountsService {
  constructor(
    @InjectRepository(OpenAccountEntity)
    private readonly repo: Repository<OpenAccountEntity>,
    @InjectRepository(OpenAccountItemEntity)
    private readonly itemRepo: Repository<OpenAccountItemEntity>,
    @InjectRepository(OpenAccountPaymentEntity)
    private readonly paymentRepo: Repository<OpenAccountPaymentEntity>,
    private readonly dataSource: DataSource,
    private readonly stockMovementsService: StockMovementsService,
  ) {}

  private serialize(
    acc: OpenAccountEntity,
    items: OpenAccountItemEntity[],
    payments: OpenAccountPaymentEntity[],
  ) {
    const sortedItems = [...items].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const sortedPayments = [...payments].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return {
      id: acc.id,
      restaurantId: acc.restaurantId,
      customerName: acc.customerName,
      customerPhone: acc.customerPhone,
      amount: Number(acc.amount),
      paidAmount: Number(acc.paidAmount ?? 0),
      status: acc.status,
      description: acc.description,
      createdBy: acc.createdBy,
      createdAt: acc.createdAt.toISOString(),
      paidAt: acc.paidAt ? acc.paidAt.toISOString() : null,
      items: sortedItems.map((i) => ({
        id: i.id,
        productId: i.productId ?? undefined,
        productName: i.productName,
        quantity: i.quantity,
        price: Number(i.price),
        note: i.note ?? undefined,
      })),
      payments: sortedPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        receivedBy: p.receivedBy,
        receivedByUserId: p.receivedByUserId ?? undefined,
        note: p.note ?? undefined,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  async list(restaurantId: string) {
    const rows = await this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
      take: 300,
    });
    if (rows.length === 0) return [];

    const accountIds = rows.map((r) => r.id);
    const [allItems, allPayments] = await Promise.all([
      this.itemRepo.find({ where: { openAccountId: In(accountIds) } }),
      this.paymentRepo.find({ where: { openAccountId: In(accountIds) } }),
    ]);

    const itemsByAccountId = new Map<string, OpenAccountItemEntity[]>();
    for (const item of allItems) {
      const list = itemsByAccountId.get(item.openAccountId) ?? [];
      list.push(item);
      itemsByAccountId.set(item.openAccountId, list);
    }

    const paymentsByAccountId = new Map<string, OpenAccountPaymentEntity[]>();
    for (const payment of allPayments) {
      const list = paymentsByAccountId.get(payment.openAccountId) ?? [];
      list.push(payment);
      paymentsByAccountId.set(payment.openAccountId, list);
    }

    return rows.map((acc) =>
      this.serialize(
        acc,
        itemsByAccountId.get(acc.id) ?? [],
        paymentsByAccountId.get(acc.id) ?? [],
      ),
    );
  }

  async create(
    restaurantId: string,
    dto: CreateOpenAccountDto & { createdBy: string },
  ) {
    const hasItems = Boolean(dto.items && dto.items.length > 0);
    let amountMinorUnits = 0;
    let description: string;

    if (hasItems) {
      for (const it of dto.items!) {
        const q = Math.max(1, Math.floor(Number(it.quantity) || 0));
        const unitMinor = toMinorUnits(it.price);
        if (unitMinor < 0) {
          throw new BadRequestException('Invalid line item price');
        }
        const name = (it.productName || '').trim();
        if (!name) throw new BadRequestException('Product name cannot be empty');
        amountMinorUnits += q * unitMinor;
      }
      if (amountMinorUnits <= 0) {
        throw new BadRequestException('Total amount must be greater than zero');
      }
      description = (dto.description ?? '').trim() || 'Check';
    } else {
      if (dto.amount == null || toMinorUnits(dto.amount) <= 0) {
        throw new BadRequestException('Either amount or item list is required');
      }
      amountMinorUnits = toMinorUnits(dto.amount);
      description = (dto.description ?? '').trim();
      if (!description) {
        throw new BadRequestException('Description is required when no items are provided');
      }
    }

    return this.dataSource.transaction(async (em) => {
      const shift = await em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
      });
      if (!shift) {
        throw new BadRequestException(
          'Cannot process transaction without an open cash shift. Please open a shift first.',
        );
      }

      const acc = em.create(OpenAccountEntity, {
        restaurantId,
        customerName: normalizeStorageText(dto.customerName),
        customerPhone: dto.customerPhone?.trim() || null,
        amount: fromMinorUnits(amountMinorUnits),
        paidAmount: 0,
        status: 'open',
        description,
        createdBy: normalizeStorageText(dto.createdBy) || 'system',
      });
      const saved = await em.save(OpenAccountEntity, acc);

      let savedItems: OpenAccountItemEntity[] = [];
      if (hasItems) {
        const rows = dto.items!.map((it, idx) =>
          em.create(OpenAccountItemEntity, {
            openAccountId: saved.id,
            productId: it.productId?.trim() || null,
            productName: normalizeStorageText(it.productName || ''),
            quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
            price: fromMinorUnits(toMinorUnits(it.price)),
            note: it.note?.trim() || null,
            sortOrder: idx,
          }),
        );
        savedItems = await em.save(OpenAccountItemEntity, rows);

        const stockLines: BilledOrderLineForStock[] = savedItems
          .filter((i) => Boolean(i.productId))
          .map((i) => ({
            productId: i.productId!,
            productName: i.productName,
            quantity: i.quantity,
          }));
        if (stockLines.length > 0) {
          await this.stockMovementsService.deductRecipeIngredients(
            em,
            restaurantId,
            stockLines,
            dto.createdBy,
            'Open account',
          );
        }
      }

      return this.serialize(saved, savedItems, []);
    });
  }

  async pay(
    restaurantId: string,
    id: string,
    amount: number,
    receivedBy: string,
    receivedByUserId?: string | null,
    paymentMethod = 'cash',
  ) {
    const payMinorUnits = toMinorUnits(amount);
    if (payMinorUnits <= 0) {
      throw new BadRequestException('Invalid payment amount');
    }
    const normalizedAmount = fromMinorUnits(payMinorUnits);
    const actorName = normalizeStorageText(receivedBy) || 'unknown';

    return this.dataSource.transaction(async (em) => {
      const shift = await em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) {
        throw new BadRequestException(
          'Cannot process transaction without an open cash shift. Please open a shift first.',
        );
      }

      const acc = await em.findOne(OpenAccountEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!acc) throw new NotFoundException('Open account not found');

      acc.applyPayment(payMinorUnits);
      await em.save(OpenAccountEntity, acc);

      const row = em.create(OpenAccountPaymentEntity, {
        openAccountId: acc.id,
        amount: normalizedAmount,
        receivedBy: actorName,
        receivedByUserId: receivedByUserId?.trim() || null,
        note: paymentMethod !== 'cash' ? `Method: ${paymentMethod}` : null,
      });
      await em.save(OpenAccountPaymentEntity, row);

      if (paymentMethod === 'cash') {
        const cashTx = em.create(CashTransactionEntity, {
          restaurantId,
          shiftId: shift.id,
          type: 'cash-in',
          amount: normalizedAmount,
          description: `Açık Hesap Tahsilatı: ${acc.customerName}`,
          reference: acc.id,
          createdBy: actorName,
        });
        await em.save(CashTransactionEntity, cashTx);
        shift.recordCashMovement('cash-in', payMinorUnits);
        await em.save(CashShiftEntity, shift);
      } else if (
        paymentMethod === 'credit-card' ||
        paymentMethod === 'meal-card' ||
        paymentMethod === 'multinet'
      ) {
        shift.recordNonCashCollection(paymentMethod, payMinorUnits);
        await em.save(CashShiftEntity, shift);
      }

      const [items, payments] = await Promise.all([
        em.find(OpenAccountItemEntity, { where: { openAccountId: acc.id } }),
        em.find(OpenAccountPaymentEntity, { where: { openAccountId: acc.id } }),
      ]);
      return this.serialize(acc, items, payments);
    });
  }
}
