import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { CashShiftService } from './cash-shift.service';
import { CreateCashTransactionDto } from '../api/dto/create-cash-transaction.dto';
import { fromKurus, toKurus } from '../../common/money/kurus';

export function serializeCashTransaction(tx: CashTransactionEntity) {
  return {
    id: tx.id,
    restaurantId: tx.restaurantId,
    shiftId: tx.shiftId,
    type: tx.type,
    amount: Number(tx.amount),
    description: tx.description,
    reference: tx.reference,
    createdBy: tx.createdBy,
    createdAt: tx.createdAt,
  };
}

@Injectable()
export class CashTransactionsService {
  constructor(
    @InjectRepository(CashTransactionEntity)
    private readonly repo: Repository<CashTransactionEntity>,
    private readonly shifts: CashShiftService,
  ) {}

  async create(
    restaurantId: string,
    dto: CreateCashTransactionDto,
    createdBy: string,
  ): Promise<{ transaction: CashTransactionEntity; shift: CashShiftEntity }> {
    const amountKurus = toKurus(dto.amount);
    if (amountKurus <= 0) {
      throw new BadRequestException('Tutar pozitif olmalidir.');
    }
    const description = dto.description.trim();
    if (!description) {
      throw new BadRequestException('Aciklama gerekli.');
    }

    return this.repo.manager.transaction(async (em) => {
      const shift = await em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) {
        throw new BadRequestException('Kasa açılmadan işlem yapılamaz. Önce kasayı açın.');
      }

      const tx = em.create(CashTransactionEntity, {
        restaurantId,
        shiftId: shift.id,
        type: dto.type,
        amount: fromKurus(amountKurus),
        description,
        reference: dto.reference?.trim() || null,
        createdBy: createdBy.trim() || 'Sistem',
      });
      const savedTx = await em.save(CashTransactionEntity, tx);

      if (dto.type === 'cash-in') {
        shift.cashIn = fromKurus(toKurus(shift.cashIn) + amountKurus);
      } else {
        shift.cashOut = fromKurus(toKurus(shift.cashOut) + amountKurus);
      }
      shift.transactionCount = (shift.transactionCount ?? 0) + 1;
      const savedShift = await em.save(CashShiftEntity, shift);

      return { transaction: savedTx, shift: savedShift };
    });
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
