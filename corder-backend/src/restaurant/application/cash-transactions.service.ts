import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashTransactionEntity } from '../domain/cash-transaction.entity';
import { CashShiftService } from './cash-shift.service';

export interface CreateCashTransactionDto {
  type: 'sale' | 'expense' | 'cash-in' | 'cash-out' | 'refund';
  amount: number;
  description: string;
  reference?: string;
  createdBy: string;
}

@Injectable()
export class CashTransactionsService {
  constructor(
    @InjectRepository(CashTransactionEntity)
    private readonly repo: Repository<CashTransactionEntity>,
    private readonly shifts: CashShiftService,
  ) {}

  async create(restaurantId: string, dto: CreateCashTransactionDto) {
    const shift = await this.shifts.requireCurrent(restaurantId);
    const tx = this.repo.create({
      restaurantId,
      shiftId: shift.id,
      type: dto.type,
      amount: dto.amount,
      description: dto.description,
      reference: dto.reference ?? null,
      createdBy: dto.createdBy,
    });
    const saved = await this.repo.save(tx);

    if (dto.type === 'sale' || dto.type === 'cash-in') {
      shift.cashIn = Number(shift.cashIn) + Number(dto.amount);
    } else {
      shift.cashOut = Number(shift.cashOut) + Number(dto.amount);
    }
    shift.transactionCount = (shift.transactionCount ?? 0) + 1;
    await (this.shifts as any).repo.save(shift);

    return { transaction: saved, shift };
  }

  async listForShift(restaurantId: string, shiftId: string) {
    return this.repo.find({
      where: { restaurantId, shiftId },
      order: { createdAt: 'DESC' },
    });
  }

  async listForCurrentShift(restaurantId: string) {
    const shift = await this.shifts.requireCurrent(restaurantId);
    return this.listForShift(restaurantId, shift.id);
  }
}

