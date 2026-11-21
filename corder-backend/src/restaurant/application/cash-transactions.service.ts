import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashShiftService } from './cash-shift.service';
import { FraudDetectionService } from './fraud-detection.service';
import { CreateCashTransactionDto } from '../api/dto/create-cash-transaction.dto';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';
import { normalizeStorageText } from '../../common/text/text-normalizer';
import { serializeCashTransaction } from './orders/order.mapper';

export { serializeCashTransaction };

@Injectable()
export class CashTransactionsService {
  constructor(
    @InjectRepository(CashTransactionEntity)
    private readonly repo: Repository<CashTransactionEntity>,
    private readonly shifts: CashShiftService,
    @Optional()
    private readonly fraudDetection?: FraudDetectionService,
  ) {}

  async create(
    restaurantId: string,
    dto: CreateCashTransactionDto,
    createdBy: string,
  ): Promise<{ transaction: CashTransactionEntity; shift: CashShiftEntity }> {
    const amountMinorUnits = toMinorUnits(dto.amount);
    if (amountMinorUnits <= 0) {
      throw new BadRequestException('Amount must be positive.');
    }
    const description = dto.description.trim();
    if (!description) {
      throw new BadRequestException('Description is required.');
    }

    const result = await this.repo.manager.transaction(async (em) => {
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

      const tx = em.create(CashTransactionEntity, {
        restaurantId,
        shiftId: shift.id,
        type: dto.type,
        amount: fromMinorUnits(amountMinorUnits),
        description,
        reference: dto.reference?.trim() || null,
        createdBy: normalizeStorageText(createdBy) || 'system',
      });
      const savedTx = await em.save(CashTransactionEntity, tx);

      shift.recordCashMovement(dto.type, amountMinorUnits, true, dto.reference);
      const savedShift = await em.save(CashShiftEntity, shift);

      return { transaction: savedTx, shift: savedShift };
    });
    void this.fraudDetection?.analyzeRestaurantAnomalies(restaurantId).catch(() => undefined);
    return result;
  }

  async listForShift(restaurantId: string, shiftId: string) {
    const rows = await this.repo.find({
      where: { restaurantId, shiftId },
      order: { createdAt: 'DESC' },
    });
    return rows.map(serializeCashTransaction);
  }

  async listForRestaurant(
    restaurantId: string,
    filters?: {
      shiftId?: string;
      from?: Date;
      to?: Date;
      type?: string;
      limit?: number;
    },
  ) {
    const safeLimit =
      filters?.limit != null &&
      Number.isFinite(filters.limit) &&
      filters.limit > 0
        ? Math.min(1000, Math.floor(filters.limit))
        : 500;

    if (typeof this.repo.createQueryBuilder === 'function') {
      const qb = this.repo
        .createQueryBuilder('t')
        .where('t.restaurant_id = :restaurantId', { restaurantId })
        .orderBy('t.created_at', 'DESC');

      if (filters?.shiftId) {
        qb.andWhere('t.shift_id = :shiftId', { shiftId: filters.shiftId });
      }
      if (filters?.from && !Number.isNaN(filters.from.getTime())) {
        qb.andWhere('t.created_at >= :from', {
          from: filters.from.toISOString(),
        });
      }
      if (filters?.to && !Number.isNaN(filters.to.getTime())) {
        qb.andWhere('t.created_at <= :to', { to: filters.to.toISOString() });
      }
      if (filters?.type) {
        qb.andWhere('t.type = :type', { type: filters.type });
      }
      qb.take(safeLimit);
      const rows = await qb.getMany();
      return rows.map(serializeCashTransaction);
    }

    const rows = await this.repo.find({
      where: {
        restaurantId,
        ...(filters?.shiftId ? { shiftId: filters.shiftId } : {}),
      },
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });
    return rows.map(serializeCashTransaction);
  }
}
