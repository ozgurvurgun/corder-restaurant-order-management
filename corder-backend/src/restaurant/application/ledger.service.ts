import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { LedgerCustomerEntity } from '../domain/ledger-customer.entity';
import { LedgerEntryEntity } from '../domain/ledger-entry.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';
import {
  formatTitleCase,
  normalizeStorageText,
} from '../../common/text/text-normalizer';
import { CreateLedgerCustomerDto } from '../api/dto/create-ledger-customer.dto';

export { CreateLedgerCustomerDto };

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerCustomerEntity)
    private readonly customerRepo: Repository<LedgerCustomerEntity>,
    @InjectRepository(LedgerEntryEntity)
    private readonly entryRepo: Repository<LedgerEntryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  private parseDateRange(
    fromIso?: string,
    toIso?: string,
  ): { from: Date; to: Date } | undefined {
    const from = (fromIso || '').trim() ? new Date(fromIso!.trim()) : undefined;
    const to = (toIso || '').trim() ? new Date(toIso!.trim()) : undefined;
    if (
      from != null &&
      to != null &&
      !Number.isNaN(from.getTime()) &&
      !Number.isNaN(to.getTime()) &&
      from.getTime() <= to.getTime()
    ) {
      return { from, to };
    }
    return undefined;
  }

  private async aggregateNetByCustomer(
    restaurantId: string,
    customerIds: string[],
    range?: { from: Date; to: Date },
  ): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (!customerIds.length) return out;
    const qb = this.entryRepo
      .createQueryBuilder('e')
      .select('e.customer_id', 'customerId')
      .addSelect(
        `SUM(CASE WHEN e.entry_type = 'debt' THEN e.amount::numeric ELSE 0 END)`,
        'debtSum',
      )
      .addSelect(
        `SUM(CASE WHEN e.entry_type = 'payment' THEN e.amount::numeric ELSE 0 END)`,
        'paySum',
      )
      .addSelect(
        `SUM(CASE WHEN e.entry_type = 'credit' THEN e.amount::numeric ELSE 0 END)`,
        'creditSum',
      )
      .where('e.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('e.customer_id IN (:...ids)', { ids: customerIds })
      .groupBy('e.customer_id');
    if (range) {
      qb.andWhere('e.created_at >= :from', { from: range.from });
      qb.andWhere('e.created_at <= :to', { to: range.to });
    }
    const rows = await qb.getRawMany<{
      customerId: string;
      debtSum: string | null;
      paySum: string | null;
      creditSum: string | null;
    }>();
    for (const r of rows) {
      const debtMinor = toMinorUnits(Number(r.debtSum || 0));
      const payMinor = toMinorUnits(Number(r.paySum || 0));
      const creditMinor = toMinorUnits(Number(r.creditSum || 0));
      out.set(r.customerId, fromMinorUnits(debtMinor - payMinor - creditMinor));
    }
    return out;
  }

  async listCustomers(restaurantId: string, fromIso?: string, toIso?: string) {
    const customers = await this.customerRepo.find({
      where: { restaurantId },
      order: { name: 'ASC' },
    });
    const ids = customers.map((c) => c.id);
    if (!ids.length) return [];
    const lifetimeMap = await this.aggregateNetByCustomer(restaurantId, ids);
    const range = this.parseDateRange(fromIso, toIso);
    const periodMap = range
      ? await this.aggregateNetByCustomer(restaurantId, ids, range)
      : null;

    const serializeRow = (c: LedgerCustomerEntity) => ({
      id: c.id,
      restaurantId: c.restaurantId,
      name: c.name,
      phone: c.phone,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      balance: lifetimeMap.get(c.id) ?? 0,
      ...(periodMap ? { periodNet: periodMap.get(c.id) ?? 0 } : {}),
    });

    if (periodMap) {
      return customers.filter((c) => periodMap.has(c.id)).map(serializeRow);
    }
    return customers.map(serializeRow);
  }

  async createCustomer(restaurantId: string, dto: CreateLedgerCustomerDto) {
    const name = normalizeStorageText(dto.name);
    if (!name) throw new BadRequestException('Ledger customer name is required');
    const row = this.customerRepo.create({
      restaurantId,
      name,
      phone: dto.phone?.trim() || null,
      notes: dto.notes?.trim() || null,
    });
    const saved = await this.customerRepo.save(row);
    return {
      id: saved.id,
      restaurantId: saved.restaurantId,
      name: saved.name,
      phone: saved.phone,
      notes: saved.notes,
      createdAt: saved.createdAt.toISOString(),
      balance: 0,
    };
  }

  async listEntries(
    restaurantId: string,
    customerId: string,
    fromIso?: string,
    toIso?: string,
  ) {
    await this.assertCustomer(restaurantId, customerId);
    const range = this.parseDateRange(fromIso, toIso);

    const qb = this.entryRepo
      .createQueryBuilder('e')
      .select([
        'e.id',
        'e.entryType',
        'e.amount',
        'e.description',
        'e.tableId',
        'e.tableName',
        'e.completedOrderId',
        'e.receivedBy',
        'e.receivedByUserId',
        'e.createdAt',
      ])
      .where('e.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('e.customer_id = :customerId', { customerId })
      .orderBy('e.created_at', 'DESC');
    if (range) {
      qb.andWhere('e.created_at >= :from', { from: range.from });
      qb.andWhere('e.created_at <= :to', { to: range.to });
    } else {
      qb.take(500);
    }
    const list = await qb.getMany();
    return list.map((e) => ({
      id: e.id,
      entryType: e.entryType,
      amount: Number(e.amount),
      description: e.description,
      tableId: e.tableId,
      tableName: e.tableName,
      completedOrderId: e.completedOrderId,
      receivedBy: e.receivedBy,
      receivedByUserId: e.receivedByUserId,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  private async getCustomerBalanceMinorUnits(
    em: EntityManager,
    restaurantId: string,
    customerId: string,
  ): Promise<number> {
    if (typeof em.createQueryBuilder === 'function') {
      const raw = await em
        .createQueryBuilder(LedgerEntryEntity, 'e')
        .select(`SUM(CASE WHEN e.entry_type = 'debt' THEN e.amount::numeric ELSE 0 END)`, 'debtSum')
        .addSelect(`SUM(CASE WHEN e.entry_type = 'payment' THEN e.amount::numeric ELSE 0 END)`, 'paySum')
        .addSelect(`SUM(CASE WHEN e.entry_type = 'credit' THEN e.amount::numeric ELSE 0 END)`, 'creditSum')
        .where('e.restaurant_id = :restaurantId', { restaurantId })
        .andWhere('e.customer_id = :customerId', { customerId })
        .getRawOne<{ debtSum: string | null; paySum: string | null; creditSum: string | null }>();
      return (
        toMinorUnits(Number(raw?.debtSum || 0)) -
        toMinorUnits(Number(raw?.paySum || 0)) -
        toMinorUnits(Number(raw?.creditSum || 0))
      );
    }
    const rows = await em.find(LedgerEntryEntity, { where: { restaurantId, customerId } });
    return rows.reduce((acc, row) => {
      const amt = toMinorUnits(Number(row.amount || 0));
      return row.entryType === 'debt' ? acc + amt : acc - amt;
    }, 0);
  }

  async recordPayment(
    restaurantId: string,
    customerId: string,
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
    const actorName = (receivedBy ?? '').trim() || 'System';

    await this.dataSource.transaction(async (em) => {
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

      const customer = await this.assertCustomer(restaurantId, customerId, em, true);
      const currentBalanceMinorUnits = await this.getCustomerBalanceMinorUnits(
        em,
        restaurantId,
        customer.id,
      );
      if (currentBalanceMinorUnits <= 0) {
        throw new BadRequestException('Customer has no outstanding debt balance');
      }
      if (payMinorUnits > currentBalanceMinorUnits) {
        throw new BadRequestException('Payment amount cannot exceed customer debt balance');
      }
      const row = em.create(LedgerEntryEntity, {
        restaurantId,
        customerId: customer.id,
        entryType: 'payment',
        amount: normalizedAmount,
        description:
          paymentMethod && paymentMethod !== 'cash'
            ? `Cari Tahsilat (${paymentMethod})`
            : 'Cari Tahsilat',
        tableId: null,
        tableName: null,
        completedOrderId: null,
        snapshot: { paymentMethod },
        receivedBy: actorName,
        receivedByUserId: receivedByUserId?.trim() || null,
      });
      await em.save(LedgerEntryEntity, row);

      if (paymentMethod === 'cash') {
        const cashTx = em.create(CashTransactionEntity, {
          restaurantId,
          shiftId: shift.id,
          type: 'cash-in',
          amount: normalizedAmount,
          description: `Cari Tahsilat: ${formatTitleCase(customer.name, 'tr') || customer.name}`,
          reference: customer.id,
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
    });

    const customers = await this.listCustomers(restaurantId);
    const customer = customers.find((x) => x.id === customerId);
    if (!customer) throw new NotFoundException('Ledger customer not found');
    return customer;
  }

  async assertCustomer(
    restaurantId: string, customerId: string, em?: EntityManager, lock = false,
  ): Promise<LedgerCustomerEntity> {
    const customer = em
      ? await em.findOne(LedgerCustomerEntity, {
          where: { id: customerId, restaurantId },
          ...(lock ? { lock: { mode: 'pessimistic_write' as const } } : {}),
        })
      : await this.customerRepo.findOne({ where: { id: customerId, restaurantId } });
    if (!customer) throw new NotFoundException('Ledger customer not found');
    return customer;
  }

  async recordDebtInTransaction(
    em: EntityManager,
    params: {
      restaurantId: string; customerId: string; amount: number; description: string;
      tableId?: string | null; tableName?: string | null; completedOrderId: string;
      snapshot: unknown; recordedBy?: string | null;
    },
  ): Promise<void> {
    const minorUnits = toMinorUnits(params.amount);
    if (minorUnits < 0) throw new BadRequestException('Invalid debt amount');
    await this.assertCustomer(params.restaurantId, params.customerId, em, true);
    await em.save(LedgerEntryEntity, em.create(LedgerEntryEntity, {
      restaurantId: params.restaurantId, customerId: params.customerId, entryType: 'debt',
      amount: fromMinorUnits(minorUnits), description: params.description,
      tableId: params.tableId?.trim() || null, tableName: params.tableName?.trim() || null,
      completedOrderId: params.completedOrderId, snapshot: params.snapshot ?? null,
      receivedBy: (params.recordedBy ?? '').trim() || null, receivedByUserId: null,
    }));
  }

  async recordStandaloneDebt(
    em: EntityManager,
    params: {
      restaurantId: string; customerId: string; amount: number; description: string;
      tableId?: string | null; tableName?: string | null; snapshot: unknown; recordedBy?: string | null;
    },
  ): Promise<void> {
    const minorUnits = toMinorUnits(params.amount);
    if (minorUnits <= 0) throw new BadRequestException('Invalid debt amount');
    await this.assertCustomer(params.restaurantId, params.customerId, em, true);
    await em.save(LedgerEntryEntity, em.create(LedgerEntryEntity, {
      restaurantId: params.restaurantId, customerId: params.customerId, entryType: 'debt',
      amount: fromMinorUnits(minorUnits), description: params.description.trim() || 'Ledger item assignment',
      tableId: params.tableId?.trim() || null, tableName: params.tableName?.trim() || null,
      completedOrderId: null, snapshot: params.snapshot ?? null,
      receivedBy: (params.recordedBy ?? '').trim() || null, receivedByUserId: null,
    }));
  }

  async recordStandaloneCredit(
    em: EntityManager,
    params: {
      restaurantId: string; customerId: string; amount: number; description: string;
      tableId?: string | null; tableName?: string | null; snapshot?: unknown; recordedBy?: string | null;
    },
  ): Promise<void> {
    const minorUnits = toMinorUnits(params.amount);
    if (minorUnits <= 0) throw new BadRequestException('Invalid credit amount');
    await this.assertCustomer(params.restaurantId, params.customerId, em, true);
    await em.save(LedgerEntryEntity, em.create(LedgerEntryEntity, {
      restaurantId: params.restaurantId, customerId: params.customerId, entryType: 'credit',
      amount: fromMinorUnits(minorUnits), description: (params.description ?? '').trim() || 'Revert ledger item',
      tableId: params.tableId?.trim() || null, tableName: params.tableName?.trim() || null,
      completedOrderId: null, snapshot: params.snapshot ?? null,
      receivedBy: (params.recordedBy ?? '').trim() || null, receivedByUserId: null,
    }));
  }

  async reconcileCompletedOrderDebtInTransaction(
    em: EntityManager,
    params: {
      restaurantId: string;
      completedOrderId: string;
      tableId?: string | null;
      tableName?: string | null;
      nextCustomerId?: string | null;
      nextLedgerMinorUnits: number;
      snapshot: unknown;
      recordedBy?: string | null;
    },
  ): Promise<LedgerCustomerEntity | null> {
    const existingEntries = await em.find(LedgerEntryEntity, {
      where: {
        restaurantId: params.restaurantId,
        completedOrderId: params.completedOrderId,
        entryType: 'debt',
      },
      order: { createdAt: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });

    if (params.nextLedgerMinorUnits <= 0 || !params.nextCustomerId) {
      if (existingEntries.length > 0) {
        await em.remove(LedgerEntryEntity, existingEntries);
      }
      return null;
    }

    const nextCustomer = await this.assertCustomer(
      params.restaurantId,
      params.nextCustomerId,
      em,
      true,
    );
    const normalizedAmount = fromMinorUnits(params.nextLedgerMinorUnits);

    if (existingEntries.length > 0) {
      const primary = existingEntries[0];
      primary.customerId = nextCustomer.id;
      primary.amount = normalizedAmount;
      primary.tableId = params.tableId?.trim() || primary.tableId;
      primary.tableName = params.tableName?.trim() || primary.tableName;
      primary.snapshot = params.snapshot ?? primary.snapshot;
      primary.receivedBy = (params.recordedBy ?? '').trim() || primary.receivedBy;
      await em.save(LedgerEntryEntity, primary);
      if (existingEntries.length > 1) {
        await em.remove(LedgerEntryEntity, existingEntries.slice(1));
      }
    } else {
      const displayTable = formatTitleCase(params.tableName || 'Masa', 'tr') || 'Masa';
      await this.recordDebtInTransaction(em, {
        restaurantId: params.restaurantId,
        customerId: nextCustomer.id,
        amount: normalizedAmount,
        description: `${displayTable} Hesap Kapanışı`,
        tableId: params.tableId ?? null,
        tableName: params.tableName ?? null,
        completedOrderId: params.completedOrderId,
        snapshot: params.snapshot,
        recordedBy: params.recordedBy,
      });
    }
    return nextCustomer;
  }

  async findStandaloneDebtEntryForOrderItem(
    em: EntityManager,
    restaurantId: string,
    orderItemId: string,
  ): Promise<LedgerEntryEntity | null> {
    return em
      .createQueryBuilder(LedgerEntryEntity, 'e')
      .where('e.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('e.completed_order_id IS NULL')
      .andWhere("e.entry_type = 'debt'")
      .andWhere(
        `(
          e.snapshot->>'sourceOrderItemId' = :orderItemId
          OR (jsonb_typeof(e.snapshot->'items') = 'array' AND (
            e.snapshot->'items' @> :byOrderItemId::jsonb
            OR e.snapshot->'items' @> :byId::jsonb
          ))
        )`,
        {
          orderItemId,
          byOrderItemId: JSON.stringify([{ orderItemId }]),
          byId: JSON.stringify([{ id: orderItemId }]),
        },
      )
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM ledger_entries cr
          WHERE cr.restaurant_id = e.restaurant_id
            AND cr.entry_type = 'credit'
            AND cr.snapshot->>'originalDebtEntryId' = e.id::text
        )`,
      )
      .orderBy('e.created_at', 'DESC')
      .getOne();
  }
}
