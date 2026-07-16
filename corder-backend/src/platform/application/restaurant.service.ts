import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { CreateRestaurantDto } from '../api/dto/create-restaurant.dto';
import { UpdateRestaurantDto } from '../api/dto/update-restaurant.dto';

@Injectable()
export class RestaurantService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly repo: Repository<RestaurantEntity>,
  ) {}

  async findAll(): Promise<RestaurantEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<RestaurantEntity> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Restaurant not found');
    return r;
  }

  async findBySlug(slug: string): Promise<RestaurantEntity | null> {
    return this.repo.findOne({ where: { slug } });
  }

  async create(dto: CreateRestaurantDto): Promise<RestaurantEntity> {
    const slug = dto.slug.toLowerCase().trim();
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing) throw new ConflictException('Slug already in use');
    const printAgentToken = dto.printAgentToken?.trim() || null;
    if (printAgentToken) {
      const tokenOwner = await this.repo.findOne({ where: { printAgentToken } });
      if (tokenOwner) throw new ConflictException('Print agent token already in use');
    }
    const entity = this.repo.create({
      ...dto,
      slug,
      printAgentToken,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateRestaurantDto): Promise<RestaurantEntity> {
    const entity = await this.findOne(id);
    if (dto.slug !== undefined) {
      const slug = dto.slug.toLowerCase().trim();
      if (slug !== entity.slug) {
        const existing = await this.repo.findOne({ where: { slug } });
        if (existing) throw new ConflictException('Slug already in use');
      }
      entity.slug = slug;
    }
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.address !== undefined) entity.address = dto.address;
    if (dto.phone !== undefined) entity.phone = dto.phone;
    if (dto.email !== undefined) entity.email = dto.email;
    if (dto.status !== undefined) entity.status = dto.status;
    if (dto.taxId !== undefined) entity.taxId = dto.taxId ?? null;
    if (dto.whatsapp !== undefined) entity.whatsapp = dto.whatsapp ?? null;
    if (dto.instagram !== undefined) entity.instagram = dto.instagram ?? null;
    if (dto.facebook !== undefined) entity.facebook = dto.facebook ?? null;
    if (dto.website !== undefined) entity.website = dto.website ?? null;
    if (dto.workingHours !== undefined) entity.workingHours = dto.workingHours ?? null;
    if (dto.terminalEmail !== undefined) entity.terminalEmail = dto.terminalEmail?.trim() || null;
    if (dto.terminalPassword !== undefined && dto.terminalPassword.length > 0) {
      entity.terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
    }
    if (dto.printAgentToken !== undefined) {
      const token = dto.printAgentToken?.trim() || null;
      if (token && token !== entity.printAgentToken) {
        const tokenOwner = await this.repo.findOne({ where: { printAgentToken: token } });
        if (tokenOwner && tokenOwner.id !== entity.id) {
          throw new ConflictException('Print agent token already in use');
        }
      }
      entity.printAgentToken = token;
    }
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
  }
}
