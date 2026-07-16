import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpenAccountEntity } from '../domain/open-account.entity';
import { OpenAccountItemEntity } from '../domain/open-account-item.entity';
import { OpenAccountPaymentEntity } from '../domain/open-account-payment.entity';

export interface CreateOpenAccountItemDto {
  productName: string;
  quantity: number;
  price: number;
  productId?: string;
  note?: string;
}

export interface CreateOpenAccountDto {
  customerName: string;
  customerPhone?: string;
  /** For single-amount (legacy) mode; may be empty when `items` is set. */
  amount?: number;
  /** Account / check note */
  description?: string;
  createdBy: string;
  /** Check lines; when set, `amount` is computed from the lines. */
  items?: CreateOpenAccountItemDto[];
}

@Injectable()
export class OpenAccountsService {
  constructor(
    @InjectRepository(OpenAccountEntity)
    private readonly repo: Repository<OpenAccountEntity>,
    @InjectRepository(OpenAccountItemEntity)
    private readonly itemRepo: Repository<OpenAccountItemEntity>,
    @InjectRepository(OpenAccountPaymentEntity)
    private readonly paymentRepo: Repository<OpenAccountPaymentEntity>,
  ) {}

  private serialize(
    acc: OpenAccountEntity,
    items: OpenAccountItemEntity[],
    payments: OpenAccountPaymentEntity[],
  ) {
    const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
    const sortedPayments = [...payments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return {
      id: acc.id,
      restaurantId: acc.restaurantId,
      customerName: acc.customerName,
      customerPhone: acc.customerPhone,
      amount: Number(acc.amount),
      paidAmount: Number(acc.paidAmount ?? 0),
      status: acc.status,
      description: acc.description,
      createdBy: acc.createdBy,
      createdAt: acc.createdAt.toISOString(),
      paidAt: acc.paidAt ? acc.paidAt.toISOString() : null,
      items: sortedItems.map((i) => ({
        id: i.id,
        productId: i.productId ?? undefined,
        productName: i.productName,
        quantity: i.quantity,
        price: Number(i.price),
        note: i.note ?? undefined,
      })),
      payments: sortedPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        receivedBy: p.receivedBy,
        receivedByUserId: p.receivedByUserId ?? undefined,
        note: p.note ?? undefined,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  }

  async list(restaurantId: string) {
    const rows = await this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
    const out = [];
    for (const acc of rows) {
      const [items, payments] = await Promise.all([
        this.itemRepo.find({ where: { openAccountId: acc.id } }),
        this.paymentRepo.find({ where: { openAccountId: acc.id } }),
      ]);
      out.push(this.serialize(acc, items, payments));
    }
    return out;
  }

  async create(restaurantId: string, dto: CreateOpenAccountDto) {
    const hasItems = dto.items && dto.items.length > 0;
    let amount: number;
    let description: string;

    if (hasItems) {
      amount = dto.items!.reduce((s, it) => {
        const q = Math.max(1, Math.floor(Number(it.quantity) || 0));
        const p = Number(it.price);
        if (!Number.isFinite(p) || p < 0) throw new BadRequestException('Gecersiz satir fiyati');
        const name = (it.productName || '').trim();
        if (!name) throw new BadRequestException('Urun adi bos olamaz');
        return s + q * p;
      }, 0);
      if (amount <= 0) throw new BadRequestException('Toplam tutar sifirdan buyuk olmali');
      description = (dto.description ?? '').trim() || 'Adisyon';
    } else {
      if (dto.amount == null || !Number.isFinite(Number(dto.amount)) || Number(dto.amount) <= 0) {
        throw new BadRequestException('Tutar veya satir listesi gerekli');
      }
      amount = Number(dto.amount);
      description = (dto.description ?? '').trim();
      if (!description) throw new BadRequestException('Aciklama gerekli (satir yokken)');
    }

    const acc = this.repo.create({
      restaurantId,
      customerName: dto.customerName.trim(),
      customerPhone: dto.customerPhone?.trim() || null,
      amount,
      paidAmount: 0,
      status: 'open',
      description,
      createdBy: dto.createdBy,
    });
    const saved = await this.repo.save(acc);

    if (hasItems) {
      const rows = dto.items!.map((it, idx) =>
        this.itemRepo.create({
          openAccountId: saved.id,
          productId: it.productId?.trim() || null,
          productName: (it.productName || '').trim(),
          quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
          price: Number(it.price),
          note: it.note?.trim() || null,
          sortOrder: idx,
        }),
      );
      await this.itemRepo.save(rows);
    }

    const items = await this.itemRepo.find({ where: { openAccountId: saved.id } });
    const payments = await this.paymentRepo.find({ where: { openAccountId: saved.id } });
    return this.serialize(saved, items, payments);
  }

  async pay(
    restaurantId: string,
    id: string,
    amount: number,
    receivedBy: string,
    receivedByUserId?: string | null,
  ) {
    const payAmt = Number(amount);
    if (!Number.isFinite(payAmt) || payAmt <= 0) {
      throw new BadRequestException('Odeme tutari gecersiz');
    }

    const acc = await this.repo.findOne({ where: { id, restaurantId } });
    if (!acc) throw new NotFoundException('Acik hesap bulunamadi');

    const paid = Number(acc.paidAmount ?? 0) + payAmt;
    if (paid > Number(acc.amount) + 0.0001) {
      throw new BadRequestException('Odeme toplam borcu asamaz');
    }

    acc.paidAmount = paid;
    if (paid >= Number(acc.amount)) {
      acc.status = 'paid';
      acc.paidAt = new Date();
    } else {
      acc.status = 'partial';
    }
    await this.repo.save(acc);

    const row = this.paymentRepo.create({
      openAccountId: acc.id,
      amount: payAmt,
      receivedBy: receivedBy.trim() || 'Bilinmiyor',
      receivedByUserId: receivedByUserId?.trim() || null,
      note: null,
    });
    await this.paymentRepo.save(row);

    const items = await this.itemRepo.find({ where: { openAccountId: acc.id } });
    const payments = await this.paymentRepo.find({ where: { openAccountId: acc.id } });
    return this.serialize(acc, items, payments);
  }
}
