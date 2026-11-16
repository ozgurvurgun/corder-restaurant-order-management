import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RootAdminEntity } from '../domain/root-admin.entity';
import { BossRestaurantEntity } from '../domain/boss-restaurant.entity';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { CreateRootAdminDto } from '../api/dto/create-root-admin.dto';
import { UpdateRootAdminDto } from '../api/dto/update-root-admin.dto';

export interface BossWithRestaurantsDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  restaurantId: string | null;
  restaurants: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
  }>;
  createdAt: Date;
}

@Injectable()
export class RootAdminService {
  constructor(
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(BossRestaurantEntity)
    private readonly bossRestaurantRepo: Repository<BossRestaurantEntity>,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
  ) {}

  async enrichBoss(admin: RootAdminEntity): Promise<BossWithRestaurantsDto> {
    const links = await this.bossRestaurantRepo.find({
      where: { bossId: admin.id },
      order: { createdAt: 'ASC' },
    });
    const restIds = new Set<string>(links.map((l) => l.restaurantId));
    if (admin.restaurantId) restIds.add(admin.restaurantId);
    const restaurants =
      restIds.size > 0
        ? await this.restaurantRepo.find({
            where: { id: In(Array.from(restIds)) },
            order: { createdAt: 'ASC' },
          })
        : [];
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone ?? null,
      isActive: admin.isActive ?? true,
      restaurantId: admin.restaurantId ?? restaurants[0]?.id ?? null,
      restaurants: restaurants.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
      })),
      createdAt: admin.createdAt,
    };
  }

  async findAllBosses(): Promise<BossWithRestaurantsDto[]> {
    const list = await this.rootAdminRepo.find({ order: { createdAt: 'DESC' } });
    return Promise.all(list.map((a) => this.enrichBoss(a)));
  }

  async findByRestaurantId(restaurantId: string): Promise<BossWithRestaurantsDto[]> {
    const links = await this.bossRestaurantRepo.find({ where: { restaurantId } });
    const direct = await this.rootAdminRepo.find({ where: { restaurantId } });
    const bossIds = new Set<string>([
      ...links.map((l) => l.bossId),
      ...direct.map((d) => d.id),
    ]);
    if (bossIds.size === 0) return [];
    const bosses = await this.rootAdminRepo.find({
      where: { id: In(Array.from(bossIds)) },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(bosses.map((b) => this.enrichBoss(b)));
  }

  async findOne(id: string): Promise<BossWithRestaurantsDto> {
    const a = await this.rootAdminRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Boss account not found');
    return this.enrichBoss(a);
  }

  async findOneByEmail(email: string): Promise<RootAdminEntity | null> {
    return this.rootAdminRepo.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: ['restaurant'],
    });
  }

  private async ensureBossRestaurantLinks(
    bossId: string,
    restaurantIds: string[],
  ): Promise<void> {
    for (const rId of restaurantIds) {
      const existing = await this.bossRestaurantRepo.findOne({
        where: { bossId, restaurantId: rId },
      });
      if (!existing) {
        await this.bossRestaurantRepo.save(
          this.bossRestaurantRepo.create({
            bossId,
            restaurantId: rId,
            title: 'Owner',
          }),
        );
      }
      await this.restaurantRepo.update(rId, { rootAdminId: bossId });
    }
  }

  async create(dto: CreateRootAdminDto): Promise<BossWithRestaurantsDto> {
    const targetRestaurantIds = Array.from(
      new Set([
        ...(dto.restaurantId ? [dto.restaurantId] : []),
        ...(dto.restaurantIds ?? []),
      ]),
    );
    if (targetRestaurantIds.length > 0) {
      const found = await this.restaurantRepo.find({
        where: { id: In(targetRestaurantIds) },
      });
      if (found.length !== targetRestaurantIds.length) {
        throw new NotFoundException('One or more selected restaurants were not found');
      }
    }

    const email = dto.email.toLowerCase().trim();
    const existingGlobal = await this.findOneByEmail(email);

    // If Boss already exists and a restaurantId is being attached, link them to the new branch!
    if (existingGlobal) {
      if (targetRestaurantIds.length > 0) {
        await this.ensureBossRestaurantLinks(existingGlobal.id, targetRestaurantIds);
        if (!existingGlobal.restaurantId) {
          existingGlobal.restaurantId = targetRestaurantIds[0];
          await this.rootAdminRepo.save(existingGlobal);
        }
        return this.enrichBoss(existingGlobal);
      }
      throw new ConflictException('A Boss account with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const primaryRestaurantId = targetRestaurantIds[0] ?? null;
    const entity = this.rootAdminRepo.create({
      restaurantId: primaryRestaurantId,
      email,
      name: dto.name.trim(),
      phone: dto.phone?.trim() || null,
      isActive: true,
      passwordHash,
    });
    const saved = await this.rootAdminRepo.save(entity);

    if (targetRestaurantIds.length > 0) {
      await this.ensureBossRestaurantLinks(saved.id, targetRestaurantIds);
    }

    if (primaryRestaurantId && dto.terminalEmail?.trim() && dto.terminalPassword) {
      const terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
      await this.restaurantRepo.update(primaryRestaurantId, {
        terminalEmail: dto.terminalEmail.toLowerCase().trim(),
        terminalPasswordHash,
      });
    }
    return this.enrichBoss(saved);
  }

  async linkExistingBossToRestaurant(
    bossId: string,
    restaurantId: string,
  ): Promise<BossWithRestaurantsDto> {
    const boss = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (!boss) throw new NotFoundException('Boss account not found');
    const rest = await this.restaurantRepo.findOne({ where: { id: restaurantId } });
    if (!rest) throw new NotFoundException('Restaurant not found');
    await this.ensureBossRestaurantLinks(boss.id, [restaurantId]);
    if (!boss.restaurantId) {
      boss.restaurantId = restaurantId;
      await this.rootAdminRepo.save(boss);
    }
    return this.enrichBoss(boss);
  }

  async unlinkBossFromRestaurant(
    bossId: string,
    restaurantId: string,
  ): Promise<void> {
    await this.bossRestaurantRepo.delete({ bossId, restaurantId });
    const boss = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (boss && boss.restaurantId === restaurantId) {
      const remaining = await this.bossRestaurantRepo.find({
        where: { bossId },
        order: { createdAt: 'ASC' },
      });
      boss.restaurantId = remaining[0]?.restaurantId ?? null;
      await this.rootAdminRepo.save(boss);
    }
  }

  async update(id: string, dto: UpdateRootAdminDto): Promise<BossWithRestaurantsDto> {
    const entity = await this.rootAdminRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Boss account not found');

    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.phone !== undefined) entity.phone = dto.phone?.trim() || null;
    if (dto.isActive !== undefined) entity.isActive = Boolean(dto.isActive);
    if (dto.email !== undefined) {
      const email = dto.email.toLowerCase().trim();
      const existing = await this.findOneByEmail(email);
      if (existing && existing.id !== id) {
        throw new ConflictException('This email address is already in use by another Boss account');
      }
      entity.email = email;
    }
    if (dto.password !== undefined && dto.password.length > 0) {
      entity.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.restaurantIds !== undefined) {
      const nextIds = Array.from(new Set(dto.restaurantIds));
      await this.bossRestaurantRepo.delete({ bossId: id });
      if (nextIds.length > 0) {
        await this.ensureBossRestaurantLinks(id, nextIds);
      }
      entity.restaurantId = nextIds[0] ?? null;
    }

    const saved = await this.rootAdminRepo.save(entity);

    if (
      saved.restaurantId &&
      (dto.terminalEmail !== undefined ||
        (dto.terminalPassword !== undefined && dto.terminalPassword.length > 0))
    ) {
      const update: { terminalEmail?: string | null; terminalPasswordHash?: string } = {};
      if (dto.terminalEmail !== undefined) {
        update.terminalEmail = dto.terminalEmail?.toLowerCase().trim() || null;
      }
      if (dto.terminalPassword !== undefined && dto.terminalPassword.length > 0) {
        update.terminalPasswordHash = await bcrypt.hash(dto.terminalPassword, 10);
      }
      if (Object.keys(update).length) {
        await this.restaurantRepo.update(saved.restaurantId, update);
      }
    }
    return this.enrichBoss(saved);
  }

  async remove(id: string, fromRestaurantId?: string): Promise<void> {
    const entity = await this.rootAdminRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('Boss account not found');

    if (fromRestaurantId) {
      const links = await this.bossRestaurantRepo.find({ where: { bossId: id } });
      if (links.length > 1) {
        await this.unlinkBossFromRestaurant(id, fromRestaurantId);
        return;
      }
    }

    if (entity.restaurantId) {
      await this.restaurantRepo.update(entity.restaurantId, { rootAdminId: null });
    }
    await this.bossRestaurantRepo.delete({ bossId: id });
    await this.rootAdminRepo.remove(entity);
  }
}
