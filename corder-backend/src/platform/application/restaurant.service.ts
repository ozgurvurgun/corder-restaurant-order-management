import { Injectable, ConflictException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { CreateRestaurantDto } from '../api/dto/create-restaurant.dto';
import { UpdateRestaurantDto } from '../api/dto/update-restaurant.dto';

@Injectable()
export class RestaurantService implements OnModuleInit {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly repo: Repository<RestaurantEntity>,
  ) {}

  async onModuleInit() {
    await this.repo.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "print_agent_username" character varying,
        ADD COLUMN IF NOT EXISTS "print_agent_password_hash" character varying;
    `);
    await this.repo.query(`
      DROP INDEX IF EXISTS "IDX_restaurants_print_agent_token_hash";
      ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "print_agent_token_hash";
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_restaurants_print_agent_username"
        ON "restaurants" ("print_agent_username")
        WHERE "print_agent_username" IS NOT NULL;
    `);
  }

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
    const {
      printAgentUsername: rawUsername,
      printAgentPassword: rawPassword,
      ...restDto
    } = dto;
    const printAgentUsername = rawUsername?.trim().toLowerCase() || null;
    if (printAgentUsername) {
      const owner = await this.repo.findOne({ where: { printAgentUsername } });
      if (owner) throw new ConflictException('Print agent username already in use');
    }
    const printAgentPasswordHash =
      rawPassword && rawPassword.length > 0 ? await bcrypt.hash(rawPassword, 10) : null;
    const entity = this.repo.create({
      ...restDto,
      slug,
      printAgentUsername,
      printAgentPasswordHash,
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
    if (dto.printAgentUsername !== undefined) {
      const nextUsername = dto.printAgentUsername?.trim().toLowerCase() || null;
      if (nextUsername && nextUsername !== entity.printAgentUsername) {
        const owner = await this.repo.findOne({ where: { printAgentUsername: nextUsername } });
        if (owner && owner.id !== entity.id) {
          throw new ConflictException('Print agent username already in use');
        }
      }
      entity.printAgentUsername = nextUsername;
    }
    if (dto.printAgentPassword !== undefined && dto.printAgentPassword.length > 0) {
      entity.printAgentPasswordHash = await bcrypt.hash(dto.printAgentPassword, 10);
    }
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
  }
}
