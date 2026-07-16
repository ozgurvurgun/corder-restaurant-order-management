import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThanOrEqual, LessThanOrEqual, Repository } from 'typeorm';
import { AuditLogEntity, AuditCategory } from '../domain/audit-log.entity';

export interface CreateAuditLogDto {
  userId: string;
  userName: string;
  action: string;
  category: AuditCategory;
  details: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  list(
    restaurantId: string,
    opts?: { category?: AuditCategory; limit?: number; from?: Date; to?: Date },
  ) {
    const limit = opts?.limit ?? 200;
    const where: any = { restaurantId };
    if (opts?.category) where.category = opts.category;
    if (opts?.from && opts?.to) where.createdAt = Between(opts.from, opts.to);
    else if (opts?.from) where.createdAt = MoreThanOrEqual(opts.from);
    else if (opts?.to) where.createdAt = LessThanOrEqual(opts.to);
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  create(restaurantId: string, dto: CreateAuditLogDto) {
    const entity = this.repo.create({
      restaurantId,
      userId: dto.userId,
      userName: dto.userName,
      action: dto.action,
      category: dto.category,
      details: dto.details,
      metadata: dto.metadata ?? null,
    });
    return this.repo.save(entity);
  }
}

