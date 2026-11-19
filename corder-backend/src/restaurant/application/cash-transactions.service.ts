import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashShiftService } from './cash-shift.service';
import { FraudDetectionService } from './fraud-detection.service';
import { CreateCashTransactionDto } from '../api/dto/create-cash-transaction.dto';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';
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
        createdBy: createdBy.trim() || 'System',
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

  async listForCurrentShift(restaurantId: string) {
    const shift = await this.shifts.requireCurrent(restaurantId);
    return this.listForShift(restaurantId, shift.id);
  }
}
