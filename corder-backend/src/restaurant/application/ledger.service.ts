import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { LedgerCustomerEntity } from '../domain/ledger-customer.entity';
import { LedgerEntryEntity } from '../domain/ledger-entry.entity';

export interface CreateLedgerCustomerDto {
  name: string;
  phone?: string;
  notes?: string;
}

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerCustomerEntity)
    private readonly customerRepo: Repository<LedgerCustomerEntity>,
    @InjectRepository(LedgerEntryEntity)
    private readonly entryRepo: Repository<LedgerEntryEntity>,
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
      const debt = Number(r.debtSum || 0);
      const pay = Number(r.paySum || 0);
      const credit = Number(r.creditSum || 0);
      out.set(r.customerId, debt - pay - credit);
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
    const name = (dto.name || '').trim();
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
      .where('e.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('e.customer_id = :customerId', { customerId })
      .orderBy('e.created_at', 'DESC');
    if (range) {
      qb.andWhere('e.created_at >= :from', { from: range.from });
      qb.andWhere('e.created_at <= :to', { to: range.to });
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

  async addPayment(
    restaurantId: string,
    customerId: string,
    amount: number,
    receivedBy: string,
    receivedByUserId?: string | null,
  ) {
    const pay = Number(amount);
    if (!Number.isFinite(pay) || pay <= 0) {
      throw new BadRequestException('Invalid payment amount');
    }
    await this.assertCustomer(restaurantId, customerId);
    const row = this.entryRepo.create({
      restaurantId,
      customerId,
      entryType: 'payment',
      amount: pay,
      description: 'Payment received',
      tableId: null,
      tableName: null,
      completedOrderId: null,
      snapshot: null,
      receivedBy: receivedBy.trim() || null,
      receivedByUserId: receivedByUserId?.trim() || null,
    });
    await this.entryRepo.save(row);
    const customers = await this.listCustomers(restaurantId);
    const customer = customers.find((x) => x.id === customerId);
    if (!customer) throw new NotFoundException('Ledger customer not found');
    return customer;
  }

  private async assertCustomer(
    restaurantId: string,
    customerId: string,
    em?: EntityManager,
  ): Promise<LedgerCustomerEntity> {
    const customer = em
      ? await em.findOne(LedgerCustomerEntity, { where: { id: customerId, restaurantId } })
      : await this.customerRepo.findOne({ where: { id: customerId, restaurantId } });
    if (!customer) throw new NotFoundException('Ledger customer not found');
    return customer;
  }

  async recordDebtInTransaction(
    em: EntityManager,
    params: {
      restaurantId: string;
      customerId: string;
      amount: number;
      description: string;
      tableId?: string | null;
      tableName?: string | null;
      completedOrderId: string;
      snapshot: unknown;
      recordedBy?: string | null;
    },
  ): Promise<void> {
    const amt = Number(params.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      throw new BadRequestException('Invalid debt amount');
    }
    await this.assertCustomer(params.restaurantId, params.customerId, em);
    const row = em.create(LedgerEntryEntity, {
      restaurantId: params.restaurantId,
      customerId: params.customerId,
      entryType: 'debt',
      amount: amt,
      description: params.description,
      tableId: params.tableId?.trim() || null,
      tableName: params.tableName?.trim() || null,
      completedOrderId: params.completedOrderId,
      snapshot: params.snapshot ?? null,
      receivedBy: (params.recordedBy ?? '').trim() || null,
      receivedByUserId: null,
    });
    await em.save(LedgerEntryEntity, row);
  }

  async recordStandaloneDebt(
    em: EntityManager,
    params: {
      restaurantId: string;
      customerId: string;
      amount: number;
      description: string;
      tableId?: string | null;
      tableName?: string | null;
      snapshot: unknown;
      recordedBy?: string | null;
    },
  ): Promise<void> {
    const amt = Number(params.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new BadRequestException('Invalid debt amount');
    }
    await this.assertCustomer(params.restaurantId, params.customerId, em);
    const row = em.create(LedgerEntryEntity, {
      restaurantId: params.restaurantId,
      customerId: params.customerId,
      entryType: 'debt',
      amount: amt,
      description: params.description.trim() || 'Ledger item assignment',
      tableId: params.tableId?.trim() || null,
      tableName: params.tableName?.trim() || null,
      completedOrderId: null,
      snapshot: params.snapshot ?? null,
      receivedBy: (params.recordedBy ?? '').trim() || null,
      receivedByUserId: null,
    });
    await em.save(LedgerEntryEntity, row);
  }

  async recordStandaloneCredit(
    em: EntityManager,
    params: {
      restaurantId: string;
      customerId: string;
      amount: number;
      description: string;
      tableId?: string | null;
      tableName?: string | null;
      snapshot?: unknown;
      recordedBy?: string | null;
    },
  ): Promise<void> {
    const amt = Number(params.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new BadRequestException('Invalid credit amount');
    }
    await this.assertCustomer(params.restaurantId, params.customerId, em);
    const row = em.create(LedgerEntryEntity, {
      restaurantId: params.restaurantId,
      customerId: params.customerId,
      entryType: 'credit',
      amount: amt,
      description: (params.description ?? '').trim() || 'Revert ledger item',
      tableId: params.tableId?.trim() || null,
      tableName: params.tableName?.trim() || null,
      completedOrderId: null,
      snapshot: params.snapshot ?? null,
      receivedBy: (params.recordedBy ?? '').trim() || null,
      receivedByUserId: null,
    });
    await em.save(LedgerEntryEntity, row);
  }

  async findStandaloneDebtEntryForOrderItem(
    em: EntityManager,
    restaurantId: string,
    orderItemId: string,
  ): Promise<LedgerEntryEntity | null> {
    const rows = await em.find(LedgerEntryEntity, {
      where: {
        restaurantId,
        completedOrderId: IsNull(),
        entryType: 'debt',
      },
      order: { createdAt: 'DESC' },
      take: 300,
    });
    for (const entry of rows) {
      const snap = entry.snapshot as {
        items?: Array<{ orderItemId?: string; id?: string }>;
      } | null;
      const items = snap?.items ?? [];
      if (items.some((it) => (it.orderItemId ?? it.id) === orderItemId)) {
        return entry;
      }
    }
    return null;
  }
}
