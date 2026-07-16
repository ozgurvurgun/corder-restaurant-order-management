import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashShiftEntity } from '../domain/cash-shift.entity';

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
    const current = await this.getCurrent(restaurantId);
    if (current) {
      throw new BadRequestException('Zaten açık bir kasa var. Önce kasayı kapatın.');
    }
    const shift = this.repo.create({
      restaurantId,
      openedBy,
      openedAt: new Date(),
      status: 'open',
      openingBalance: Number(openingBalance) || 0,
    });
    return this.repo.save(shift);
  }

  async close(
    id: string,
    restaurantId: string,
    closedBy: string,
    closingBalance: number,
    notes?: string,
  ): Promise<CashShiftEntity> {
    const shift = await this.repo.findOne({ where: { id, restaurantId } });
    if (!shift) throw new NotFoundException('Vardiya bulunamadı.');
    if (shift.status !== 'open') {
      throw new BadRequestException('Bu vardiya zaten kapalı.');
    }
    shift.closedAt = new Date();
    shift.closedBy = closedBy;
    shift.closingBalance = Number(closingBalance);
    shift.notes = notes ?? null;
    shift.status = 'closed';
    return this.repo.save(shift);
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
