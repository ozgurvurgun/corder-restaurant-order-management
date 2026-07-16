import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BackupRecordEntity, BackupStatus, BackupType } from '../domain/backup-record.entity';

export interface CreateBackupDto {
  type: BackupType;
  size?: string;
  status?: BackupStatus;
  notes?: string;
}

@Injectable()
export class BackupsService {
  constructor(
    @InjectRepository(BackupRecordEntity)
    private readonly repo: Repository<BackupRecordEntity>,
  ) {}

  list(restaurantId: string) {
    return this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(restaurantId: string, dto: CreateBackupDto) {
    const entity = this.repo.create({
      restaurantId,
      type: dto.type,
      size: dto.size ?? '0 MB',
      status: dto.status ?? 'success',
      notes: dto.notes ?? null,
      filePath: null,
    });
    return this.repo.save(entity);
  }
}

