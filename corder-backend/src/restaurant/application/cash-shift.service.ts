import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { fromKurus, toKurus } from '../../common/money/kurus';

export function serializeCashShift(shift: CashShiftEntity) {
  return {
    id: shift.id,
    openedBy: shift.openedBy,
    openedAt: shift.openedAt,
    closedAt: shift.closedAt,
    closedBy: shift.closedBy,
    status: shift.status,
    openingBalance: Number(shift.openingBalance),
    closingBalance: shift.closingBalance != null ? Number(shift.closingBalance) : null,
    notes: shift.notes,
    cashIn: Number(shift.cashIn ?? 0),
    cashOut: Number(shift.cashOut ?? 0),
    totalRevenue: Number(shift.totalRevenue ?? 0),
    totalNakit: Number(shift.totalNakit ?? 0),
    totalKart: Number(shift.totalKart ?? 0),
    totalYemekKarti: Number(shift.totalYemekKarti ?? 0),
    totalMultinet: Number(shift.totalMultinet ?? 0),
    transactionCount: shift.transactionCount ?? 0,
  };
}

@Injectable()
export class CashShiftService {
  constructor(
    @InjectRepository(CashShiftEntity)
    private readonly repo: Repository<CashShiftEntity>,
  ) {}

  async getCurrent(restaurantId: string): Promise<CashShiftEntity | null> {
    return this.repo.findOne({
      where: { restaurantId, status: 'open' },
      order: { openedAt: 'DESC' },
    });
  }

  async open(restaurantId: string, openedBy: string, openingBalance: number): Promise<CashShiftEntity> {
    const openingKurus = Math.max(0, toKurus(openingBalance));
    return this.repo.manager.transaction(async (em) => {
      const current = await em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (current) {
        throw new BadRequestException('Zaten açık bir kasa var. Önce kasayı kapatın.');
      }
      const shift = em.create(CashShiftEntity, {
        restaurantId,
        openedBy,
        openedAt: new Date(),
        status: 'open',
        openingBalance: fromKurus(openingKurus),
        cashIn: 0,
        cashOut: 0,
        totalRevenue: 0,
        totalNakit: 0,
        totalKart: 0,
        totalYemekKarti: 0,
        totalMultinet: 0,
        transactionCount: 0,
      });
      return em.save(CashShiftEntity, shift);
    });
  }

  async close(
    id: string,
    restaurantId: string,
    closedBy: string,
    closingBalance: number,
    notes?: string,
  ): Promise<CashShiftEntity> {
    const closingKurus = Math.max(0, toKurus(closingBalance));
    return this.repo.manager.transaction(async (em) => {
      const shift = await em.findOne(CashShiftEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) throw new NotFoundException('Vardiya bulunamadı.');
      if (shift.status !== 'open') {
        throw new BadRequestException('Bu vardiya zaten kapalı.');
      }
      shift.closedAt = new Date();
      shift.closedBy = closedBy;
      shift.closingBalance = fromKurus(closingKurus);
      shift.notes = notes ?? null;
      shift.status = 'closed';
      return em.save(CashShiftEntity, shift);
    });
  }

  async list(restaurantId: string, limit = 50): Promise<CashShiftEntity[]> {
    return this.repo.find({
      where: { restaurantId },
      order: { openedAt: 'DESC' },
      take: limit,
    });
  }

  async requireCurrent(restaurantId: string): Promise<CashShiftEntity> {
    const current = await this.getCurrent(restaurantId);
    if (!current) {
      throw new BadRequestException('Kasa açılmadan işlem yapılamaz. Önce kasayı açın.');
    }
    return current;
  }
}
