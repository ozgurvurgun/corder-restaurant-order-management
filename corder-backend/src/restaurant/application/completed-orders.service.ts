import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompletedOrderEntity } from '../domain/completed-order.entity';
import { CreateCompletedOrderDto } from '../api/dto/create-completed-order.dto';
import { UpdateCompletedOrderDto } from '../api/dto/update-completed-order.dto';
import { LedgerService } from './ledger.service';

interface ListFilters {
  from?: Date;
  to?: Date;
  waiter?: string;
  tableName?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class CompletedOrdersService {
  constructor(
    @InjectRepository(CompletedOrderEntity)
    private readonly repo: Repository<CompletedOrderEntity>,
    private readonly ledgerService: LedgerService,
  ) {}

  async create(restaurantId: string, dto: CreateCompletedOrderDto): Promise<CompletedOrderEntity> {
    return this.repo.manager.transaction(async (em) => {
      const entity = em.create(CompletedOrderEntity, {
        restaurantId,
        tableName: dto.tableName,
        section: dto.section,
        waiter: dto.waiter,
        totalAmount: dto.totalAmount,
        discountAmount: dto.discountAmount,
        netAmount: dto.netAmount,
        closedBy: dto.closedBy,
        openedAt: new Date(dto.openedAt),
        closedAt: new Date(dto.closedAt),
        paymentMethod: dto.payment.method,
        paymentSplit: dto.payment.splitDetails ?? null,
        paymentDiscount: dto.payment.discount ?? null,
        paymentTip: dto.payment.tip ?? 0,
        ordersSnapshot: dto.orders,
        paymentSnapshot: dto.payment,
      });
      const saved = await em.save(CompletedOrderEntity, entity);
      if (dto.ledgerCustomerId) {
        let debt = dto.netAmount;
        if (dto.ledgerDebtAmount != null && Number.isFinite(Number(dto.ledgerDebtAmount))) {
          debt = Math.min(dto.netAmount, Math.max(0, Number(dto.ledgerDebtAmount)));
        }
        if (debt > 0) {
          await this.ledgerService.recordDebtInTransaction(em, {
            restaurantId,
            customerId: dto.ledgerCustomerId,
            amount: debt,
            description: `${dto.tableName} masasi hesabi`,
            tableId: dto.payment.tableId ?? null,
            tableName: dto.tableName,
            completedOrderId: saved.id,
            snapshot: dto.orders,
            recordedBy: (dto.closedBy ?? '').trim() || null,
          });
        }
      }
      return saved;
    });
  }

  async list(restaurantId: string, filters: ListFilters): Promise<CompletedOrderEntity[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .where('c.restaurant_id = :restaurantId', { restaurantId })
      .orderBy('c.closed_at', 'DESC');

    if (filters.from) {
      qb.andWhere('c.closed_at >= :from', { from: filters.from.toISOString() });
    }
    if (filters.to) {
      qb.andWhere('c.closed_at <= :to', { to: filters.to.toISOString() });
    }
    if (filters.waiter) {
      qb.andWhere('c.waiter = :waiter', { waiter: filters.waiter });
    }
    if (filters.tableName) {
      qb.andWhere('c.table_name = :tableName', { tableName: filters.tableName });
    }
    if (filters.limit != null) {
      qb.take(filters.limit);
    }
    if (filters.offset != null) {
      qb.skip(filters.offset);
    }
    return qb.getMany();
  }

  private sumActiveOrderLines(
    orders: { items: { status: string; price: number; quantity: number }[] }[],
  ): number {
    let sum = 0;
    for (const o of orders) {
      for (const i of o.items || []) {
        if (i.status === 'cancelled' || i.status === 'ledger') continue;
        sum += Number(i.price || 0) * Number(i.quantity || 0);
      }
    }
    return sum;
  }

  private computeDiscountAmount(
    rawTotal: number,
    discount: { type: 'percent' | 'amount'; value: number } | undefined | null,
  ): number {
    if (!discount || rawTotal <= 0) return 0;
    if (discount.type === 'percent') {
      if (discount.value >= 100) return rawTotal;
      return Math.round((rawTotal * Number(discount.value)) / 100);
    }
    return Math.min(Number(discount.value) || 0, rawTotal);
  }

  async update(
    restaurantId: string,
    id: string,
    dto: UpdateCompletedOrderDto,
  ): Promise<CompletedOrderEntity> {
    const row = await this.repo.findOne({ where: { id, restaurantId } });
    if (!row) {
      throw new NotFoundException('Tamamlanan siparis bulunamadi');
    }

    const totalAmount = this.sumActiveOrderLines(dto.orders);
    const discountAmount = this.computeDiscountAmount(totalAmount, dto.payment.discount ?? null);
    const netAmount = Math.max(0, totalAmount - discountAmount);

    const paymentSnapshot = {
      ...dto.payment,
      amount: netAmount,
    };

    row.ordersSnapshot = dto.orders as unknown[];
    row.paymentSnapshot = paymentSnapshot as unknown;
    row.totalAmount = totalAmount;
    row.discountAmount = discountAmount;
    row.netAmount = netAmount;
    row.paymentMethod = dto.payment.method;
    row.paymentTip = dto.payment.tip ?? 0;
    row.paymentSplit = dto.payment.splitDetails ?? null;
    row.paymentDiscount = dto.payment.discount ?? null;

    return this.repo.save(row);
  }
}
