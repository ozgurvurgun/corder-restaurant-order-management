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
      const d = Number(r.debtSum || 0);
      const p = Number(r.paySum || 0);
      const c = Number(r.creditSum || 0);
      out.set(r.customerId, d - p - c);
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

    const from = (fromIso || '').trim() ? new Date(fromIso!.trim()) : undefined;
    const to = (toIso || '').trim() ? new Date(toIso!.trim()) : undefined;
    const useRange =
      from != null &&
      to != null &&
      !Number.isNaN(from.getTime()) &&
      !Number.isNaN(to.getTime()) &&
      from.getTime() <= to.getTime();

    const periodMap = useRange ? await this.aggregateNetByCustomer(restaurantId, ids, { from: from!, to: to! }) : null;

    const row = (c: (typeof customers)[0]) => ({
      id: c.id,
      restaurantId: c.restaurantId,
      name: c.name,
      phone: c.phone,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      balance: lifetimeMap.get(c.id) ?? 0,
      ...(useRange && periodMap ? { periodNet: periodMap.get(c.id) ?? 0 } : {}),
    });

    if (useRange && periodMap) {
      return customers.filter((c) => periodMap.has(c.id)).map(row);
    }
    return customers.map(row);
  }

  async createCustomer(restaurantId: string, dto: CreateLedgerCustomerDto) {
    const name = (dto.name || '').trim();
    if (!name) throw new BadRequestException('Cari adi gerekli');
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

  async listEntries(restaurantId: string, customerId: string, fromIso?: string, toIso?: string) {
    await this.assertCustomer(restaurantId, customerId);
    const from = (fromIso || '').trim() ? new Date(fromIso!.trim()) : undefined;
    const to = (toIso || '').trim() ? new Date(toIso!.trim()) : undefined;
    const useRange =
      from != null &&
      to != null &&
      !Number.isNaN(from.getTime()) &&
      !Number.isNaN(to.getTime()) &&
      from.getTime() <= to.getTime();

    const qb = this.entryRepo
      .createQueryBuilder('e')
      .where('e.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('e.customer_id = :customerId', { customerId })
      .orderBy('e.created_at', 'DESC');
    if (useRange) {
      qb.andWhere('e.created_at >= :from', { from: from! });
      qb.andWhere('e.created_at <= :to', { to: to! });
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
    if (!Number.isFinite(pay) || pay <= 0) throw new BadRequestException('Tutar gecersiz');
    await this.assertCustomer(restaurantId, customerId);
    const row = this.entryRepo.create({
      restaurantId,
      customerId,
      entryType: 'payment',
      amount: pay,
      description: 'Tahsilat',
      tableId: null,
      tableName: null,
      completedOrderId: null,
      snapshot: null,
      receivedBy: receivedBy.trim() || null,
      receivedByUserId: receivedByUserId?.trim() || null,
    });
    await this.entryRepo.save(row);
    const customers = await this.listCustomers(restaurantId);
    const c = customers.find((x) => x.id === customerId);
    if (!c) throw new NotFoundException('Cari bulunamadi');
    return c;
  }

  private async assertCustomer(restaurantId: string, customerId: string): Promise<LedgerCustomerEntity> {
    const c = await this.customerRepo.findOne({ where: { id: customerId, restaurantId } });
    if (!c) throw new NotFoundException('Cari bulunamadi');
    return c;
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
      /** Panel username etc.; shown on the ledger movement list. */
      recordedBy?: string | null;
    },
  ): Promise<void> {
    const amt = Number(params.amount);
    if (!Number.isFinite(amt) || amt < 0) throw new BadRequestException('Borc tutari gecersiz');
    const cust = await em.findOne(LedgerCustomerEntity, {
      where: { id: params.customerId, restaurantId: params.restaurantId },
    });
    if (!cust) throw new NotFoundException('Cari bulunamadi');
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

  /** Debt from check lines outside a completed order (completed_order_id = null). */
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
    if (!Number.isFinite(amt) || amt <= 0) throw new BadRequestException('Borc tutari gecersiz');
    const cust = await em.findOne(LedgerCustomerEntity, {
      where: { id: params.customerId, restaurantId: params.restaurantId },
    });
    if (!cust) throw new NotFoundException('Cari bulunamadi');
    const row = em.create(LedgerEntryEntity, {
      restaurantId: params.restaurantId,
      customerId: params.customerId,
      entryType: 'debt',
      amount: amt,
      description: params.description.trim() || 'Urun cari',
      tableId: params.tableId?.trim() || null,
      tableName: params.tableName?.trim() || null,
      completedOrderId: null,
      snapshot: params.snapshot ?? null,
      receivedBy: (params.recordedBy ?? '').trim() || null,
      receivedByUserId: null,
    });
    await em.save(LedgerEntryEntity, row);
  }

  /** Entry that reduces debt when a check line is taken back from the ledger (completed_order_id = null). */
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
    if (!Number.isFinite(amt) || amt <= 0) throw new BadRequestException('Tutar gecersiz');
    const cust = await em.findOne(LedgerCustomerEntity, {
      where: { id: params.customerId, restaurantId: params.restaurantId },
    });
    if (!cust) throw new NotFoundException('Cari bulunamadi');
    const row = em.create(LedgerEntryEntity, {
      restaurantId: params.restaurantId,
      customerId: params.customerId,
      entryType: 'credit',
      amount: amt,
      description: (params.description ?? '').trim() || 'Adisyon cari geri al',
      tableId: params.tableId?.trim() || null,
      tableName: params.tableName?.trim() || null,
      completedOrderId: null,
      snapshot: params.snapshot ?? null,
      receivedBy: (params.recordedBy ?? '').trim() || null,
      receivedByUserId: null,
    });
    await em.save(LedgerEntryEntity, row);
  }

  /**
   * Finds the latest unfinished table ledger debt entry that references this order_item id.
   * Matches snapshot `items[].orderItemId` or legacy `items[].id`.
   */
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
    for (const e of rows) {
      const snap = e.snapshot as { items?: Array<{ orderItemId?: string; id?: string }> } | null;
      const items = snap?.items ?? [];
      if (items.some((it) => (it.orderItemId ?? it.id) === orderItemId)) {
        return e;
      }
    }
    return null;
  }
}
