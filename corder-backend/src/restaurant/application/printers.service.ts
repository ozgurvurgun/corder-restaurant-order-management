import { Injectable, NotFoundException } from '@nestjs/common';
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
    const connection = dto.connection;
    const entity = this.repo.create({
      restaurantId,
      name: dto.name.trim(),
      type: dto.type.trim(),
      connection,
      ipAddress: connection === 'network' ? (dto.ipAddress?.trim() || null) : (dto.ipAddress?.trim() || null),
      port: connection === 'network' ? (dto.port ?? 9100) : (dto.port ?? null),
      department: dto.department?.trim() || null,
      paperWidth: dto.paperWidth ?? 80,
      autoCut: dto.autoCut ?? true,
    });
    return this.repo.save(entity);
  }

  async update(restaurantId: string, id: string, dto: UpdatePrinterDto) {
    const existing = await this.repo.findOne({ where: { id, restaurantId } });
    if (!existing) {
      throw new NotFoundException('Printer not found');
    }
    const nextConnection = dto.connection ?? existing.connection;
    Object.assign(existing, {
      name: dto.name !== undefined ? dto.name.trim() : existing.name,
      type: dto.type !== undefined ? dto.type.trim() : existing.type,
      connection: nextConnection,
      ipAddress:
        dto.ipAddress !== undefined
          ? (dto.ipAddress?.trim() || null)
          : nextConnection !== 'network' && dto.connection !== undefined
            ? null
            : existing.ipAddress,
      port:
        dto.port !== undefined
          ? dto.port
          : nextConnection !== 'network' && dto.connection !== undefined
            ? null
            : existing.port,
      department:
        dto.department !== undefined ? (dto.department?.trim() || null) : existing.department,
      status: dto.status ?? existing.status,
      paperWidth: dto.paperWidth ?? existing.paperWidth,
      autoCut: dto.autoCut ?? existing.autoCut,
    });
    existing.updatedAt = new Date();
    return this.repo.save(existing);
  }

  async remove(restaurantId: string, id: string) {
    const res = await this.repo.delete({ id, restaurantId });
    if (!res.affected) {
      throw new NotFoundException('Printer not found');
    }
    return { ok: true };
  }
}


