import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';
import { serializeCashShift } from './orders/order.mapper';

export { serializeCashShift };

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

  async open(
    restaurantId: string,
    openedBy: string,
    openingBalance: number,
  ): Promise<CashShiftEntity> {
    const openingMinorUnits = Math.max(0, toMinorUnits(openingBalance));
    return this.repo.manager.transaction(async (em) => {
      const current = await em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (current) {
        throw new BadRequestException(
          'A cash shift is already open. Please close the current shift first.',
        );
      }
      const shift = em.create(CashShiftEntity, {
        restaurantId,
        openedBy,
        openedAt: new Date(),
        status: 'open',
        openingBalance: fromMinorUnits(openingMinorUnits),
        cashIn: 0,
        cashOut: 0,
        totalRevenue: 0,
        totalCash: 0,
        totalCard: 0,
        totalMealCard: 0,
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
    const closingMinorUnits = Math.max(0, toMinorUnits(closingBalance));
    return this.repo.manager.transaction(async (em) => {
      const shift = await em.findOne(CashShiftEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) throw new NotFoundException('Cash shift not found.');
      if (shift.status !== 'open') {
        throw new BadRequestException('This cash shift is already closed.');
      }
      shift.closeShift(closedBy, closingMinorUnits, notes);
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
      throw new BadRequestException(
        'Cannot process transaction without an open cash shift. Please open a shift first.',
      );
    }
    return current;
  }
}
