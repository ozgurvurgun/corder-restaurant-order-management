import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantStaffEntity, StaffRole } from '../domain/restaurant-staff.entity';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
  ) {}

  async list(restaurantId: string): Promise<{ id: string; name: string; email: string | null; pin: string | null; role: StaffRole; phone?: string; isActive: boolean; createdAt: string }[]> {
    const list = await this.staffRepo.find({
      where: { restaurantId },
      order: { createdAt: 'ASC' },
    });
    return list.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email ?? null,
      pin: s.pin ?? null,
      role: s.role,
      phone: s.phone ?? undefined,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async create(restaurantId: string, dto: { name: string; role: StaffRole; phone?: string; pin: string }): Promise<{ id: string; name: string; email: string | null; pin: string | null; role: StaffRole; phone?: string; isActive: boolean; createdAt: string }> {
    const pin = dto.pin.trim();
    const existing = await this.staffRepo.findOne({ where: { restaurantId, pin } });
    if (existing) throw new ConflictException('This PIN is already used for a staff in this restaurant');
    const staff = this.staffRepo.create({
      restaurantId,
      email: null,
      passwordHash: null,
      pin,
      name: dto.name.trim(),
      role: dto.role,
      phone: dto.phone?.trim() || null,
      isActive: true,
    });
    const saved = await this.staffRepo.save(staff);
    return {
      id: saved.id,
      name: saved.name,
      email: saved.email ?? null,
      pin: saved.pin ?? null,
      role: saved.role,
      phone: saved.phone ?? undefined,
      isActive: saved.isActive,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async update(restaurantId: string, id: string, dto: { name?: string; role?: StaffRole; phone?: string | null; pin?: string; isActive?: boolean }): Promise<{ id: string; name: string; email: string | null; pin: string | null; role: StaffRole; phone?: string; isActive: boolean; createdAt: string }> {
    const staff = await this.staffRepo.findOne({ where: { id, restaurantId } });
    if (!staff) throw new NotFoundException('Staff not found');
    if (dto.name != null) staff.name = dto.name.trim();
    if (dto.pin != null && dto.pin !== '') {
      const pin = dto.pin.trim();
      const existing = await this.staffRepo.findOne({ where: { restaurantId, pin } });
      if (existing && existing.id !== id) throw new ConflictException('This PIN is already used for a staff in this restaurant');
      staff.pin = pin;
    }
    if (dto.role != null) staff.role = dto.role;
    if (dto.phone !== undefined) staff.phone = dto.phone?.trim() || null;
    if (dto.isActive !== undefined) staff.isActive = dto.isActive;
    const saved = await this.staffRepo.save(staff);
    return {
      id: saved.id,
      name: saved.name,
      email: saved.email ?? null,
      pin: saved.pin ?? null,
      role: saved.role,
      phone: saved.phone ?? undefined,
      isActive: saved.isActive,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async delete(restaurantId: string, id: string): Promise<void> {
    const result = await this.staffRepo.delete({ id, restaurantId });
    if (result.affected === 0) throw new NotFoundException('Staff not found');
  }
}
