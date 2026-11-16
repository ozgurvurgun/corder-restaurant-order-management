import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrinterConfigEntity } from '../domain/printer-config.entity';
import { CreatePrinterDto } from '../api/dto/create-printer.dto';
import { UpdatePrinterDto } from '../api/dto/update-printer.dto';

export { CreatePrinterDto, UpdatePrinterDto };

@Injectable()
export class PrintersService {
  constructor(
    @InjectRepository(PrinterConfigEntity)
    private readonly repo: Repository<PrinterConfigEntity>,
  ) {}

  list(restaurantId: string) {
    return this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(restaurantId: string, dto: CreatePrinterDto) {
    const entity = this.repo.create({
      restaurantId,
      name: dto.name,
      type: dto.type,
      connection: dto.connection,
      ipAddress: dto.ipAddress ?? null,
      port: dto.port ?? null,
      department: dto.department ?? null,
      paperWidth: dto.paperWidth ?? 80,
      autoCut: dto.autoCut ?? true,
    });
    return this.repo.save(entity);
  }

  async update(restaurantId: string, id: string, dto: UpdatePrinterDto) {
    const existing = await this.repo.findOne({ where: { id, restaurantId } });
    if (!existing) return null;
    Object.assign(existing, {
      name: dto.name ?? existing.name,
      type: dto.type ?? existing.type,
      connection: dto.connection ?? existing.connection,
      ipAddress: dto.ipAddress !== undefined ? dto.ipAddress : existing.ipAddress,
      port: dto.port !== undefined ? dto.port : existing.port,
      department: dto.department !== undefined ? dto.department : existing.department,
      status: dto.status ?? existing.status,
      paperWidth: dto.paperWidth ?? existing.paperWidth,
      autoCut: dto.autoCut ?? existing.autoCut,
    });
    existing.updatedAt = new Date();
    return this.repo.save(existing);
  }

  async remove(restaurantId: string, id: string) {
    await this.repo.delete({ id, restaurantId });
  }
}

