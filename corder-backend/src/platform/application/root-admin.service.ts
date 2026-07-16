import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RootAdminEntity } from '../domain/root-admin.entity';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { CreateRootAdminDto } from '../api/dto/create-root-admin.dto';
import { UpdateRootAdminDto } from '../api/dto/update-root-admin.dto';

@Injectable()
export class RootAdminService {
  constructor(
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
  ) {}

  async findByRestaurantId(restaurantId: string): Promise<RootAdminEntity[]> {
    return this.rootAdminRepo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<RootAdminEntity> {
    const a = await this.rootAdminRepo.findOne({
      where: { id },
      relations: ['restaurant'],
    });
    if (!a) throw new NotFoundException('Root admin not found');
    return a;
  }

  async findOneByEmail(email: string): Promise<RootAdminEntity | null> {
    return this.rootAdminRepo.findOne({
      where: { email: email.toLowerCase() },
      relations: ['restaurant'],
    });
  }

  async findOneByEmailForRestaurant(email: string, restaurantId: string): Promise<RootAdminEntity | null> {
    return this.rootAdminRepo.findOne({
      where: { email: email.toLowerCase(), restaurantId },
    });
  }

  async create(dto: CreateRootAdminDto): Promise<RootAdminEntity> {
    const restaurant = await this.restaurantRepo.findOne({ where: { id: dto.restaurantId } });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    const existingGlobal = await this.findOneByEmail(dto.email);
    if (existingGlobal) throw new ConflictException('This email is already registered for another restaurant');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const entity = this.rootAdminRepo.create({
      restaurantId: dto.restaurantId,
      email: dto.email.toLowerCase().trim(),
      name: dto.name.trim(),
      passwordHash,
    });
    const saved = await this.rootAdminRepo.save(entity);
    await this.restaurantRepo.update(dto.restaurantId, { rootAdminId: saved.id });
    if (dto.terminalEmail?.trim() && dto.terminalPassword) {
      const terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
      await this.restaurantRepo.update(dto.restaurantId, {
        terminalEmail: dto.terminalEmail.toLowerCase().trim(),
        terminalPasswordHash,
      });
    }
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateRootAdminDto): Promise<RootAdminEntity> {
    const entity = await this.findOne(id);
    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();
      const existing = await this.findOneByEmail(email);
      if (existing && existing.id !== id) throw new ConflictException('This email is already registered for another restaurant');
      entity.email = email;
    }
    if (dto.password !== undefined && dto.password.length > 0) {
      entity.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    const saved = await this.rootAdminRepo.save(entity);
    if (dto.terminalEmail !== undefined || (dto.terminalPassword !== undefined && dto.terminalPassword.length > 0)) {
      const update: { terminalEmail?: string | null; terminalPasswordHash?: string } = {};
      if (dto.terminalEmail !== undefined) update.terminalEmail = dto.terminalEmail?.toLowerCase().trim() || null;
      if (dto.terminalPassword !== undefined && dto.terminalPassword.length > 0) {
        update.terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
      }
      if (Object.keys(update).length) await this.restaurantRepo.update(entity.restaurantId, update);
    }
    return saved;
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.restaurantRepo.update(entity.restaurantId, { rootAdminId: null });
    await this.rootAdminRepo.remove(entity);
  }
}
