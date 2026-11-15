import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { RestaurantStaffEntity, StaffRole } from '../domain/restaurant-staff.entity';
import { StaffSessionService } from './staff-session.service';

export interface StaffPublicDto {
  id: string;
  name: string;
  email: string | null;
  role: StaffRole;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

function serializeStaff(s: RestaurantStaffEntity): StaffPublicDto {
  return {
    id: s.id,
    name: s.name,
    email: s.email ?? null,
    role: s.role,
    phone: s.phone ?? undefined,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
  };
}

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    private readonly staffSession: StaffSessionService,
  ) {}

  async list(restaurantId: string): Promise<StaffPublicDto[]> {
    const list = await this.staffRepo.find({
      where: { restaurantId },
      order: { createdAt: 'ASC' },
    });
    return list.map(serializeStaff);
  }

  private async assertUniquePinInRestaurant(
    restaurantId: string,
    plainPin: string,
    excludeStaffId?: string,
  ): Promise<void> {
    const existingList = await this.staffRepo.find({ where: { restaurantId } });
    for (const member of existingList) {
      if (excludeStaffId && member.id === excludeStaffId) continue;
      if (member.pinHash && (await bcrypt.compare(plainPin, member.pinHash))) {
        throw new ConflictException(
          'This PIN is already used for a staff in this restaurant',
        );
      }
    }
  }

  async create(
    restaurantId: string,
    dto: { name: string; role: StaffRole; phone?: string; pin: string },
  ): Promise<StaffPublicDto> {
    const pin = dto.pin.trim();
    await this.assertUniquePinInRestaurant(restaurantId, pin);
    const pinHash = await bcrypt.hash(pin, 10);
    const staff = this.staffRepo.create({
      restaurantId,
      email: null,
      passwordHash: null,
      pinHash,
      name: dto.name.trim(),
      role: dto.role,
      phone: dto.phone?.trim() || null,
      isActive: true,
    });
    const saved = await this.staffRepo.save(staff);
    return serializeStaff(saved);
  }

  async update(
    restaurantId: string,
    id: string,
    dto: {
      name?: string;
      role?: StaffRole;
      phone?: string | null;
      pin?: string;
      isActive?: boolean;
    },
  ): Promise<StaffPublicDto> {
    const staff = await this.staffRepo.findOne({ where: { id, restaurantId } });
    if (!staff) throw new NotFoundException('Staff not found');
    if (dto.name != null) staff.name = dto.name.trim();
    if (dto.pin != null && dto.pin !== '') {
      const pin = dto.pin.trim();
      await this.assertUniquePinInRestaurant(restaurantId, pin, id);
      staff.pinHash = await bcrypt.hash(pin, 10);
    }
    if (dto.role != null) staff.role = dto.role;
    if (dto.phone !== undefined) staff.phone = dto.phone?.trim() || null;
    if (dto.isActive !== undefined) staff.isActive = dto.isActive;
    const saved = await this.staffRepo.save(staff);
    return serializeStaff(saved);
  }

  async delete(restaurantId: string, id: string): Promise<void> {
    const result = await this.staffRepo.delete({ id, restaurantId });
    if (result.affected === 0) throw new NotFoundException('Staff not found');
  }

  async verifyPin(
    restaurantId: string,
    pin: string,
  ): Promise<{
    staffId: string;
    name: string;
    role: StaffRole;
    staffToken: string;
  }> {
    const trimmed = pin.trim();
    const activeStaff = await this.staffRepo.find({
      where: { restaurantId, isActive: true },
    });
    for (const member of activeStaff) {
      if (member.pinHash && (await bcrypt.compare(trimmed, member.pinHash))) {
        const staffToken = this.staffSession.signStaffToken({
          id: member.id,
          restaurantId,
          name: member.name,
          role: member.role,
        });
        return {
          staffId: member.id,
          name: member.name,
          role: member.role,
          staffToken,
        };
      }
    }
    throw new UnauthorizedException('Gecersiz PIN');
  }
}
