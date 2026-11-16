import {
  Injectable,
  ConflictException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { RootAdminEntity } from '../domain/root-admin.entity';
import { BossRestaurantEntity } from '../domain/boss-restaurant.entity';
import { CreateRestaurantDto } from '../api/dto/create-restaurant.dto';
import { UpdateRestaurantDto } from '../api/dto/update-restaurant.dto';

export function getCurrentBillingPeriod(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

@Injectable()
export class RestaurantService implements OnModuleInit {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly repo: Repository<RestaurantEntity>,
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(BossRestaurantEntity)
    private readonly bossRestaurantRepo: Repository<BossRestaurantEntity>,
  ) {}

  async onModuleInit() {
    await this.repo.query(`
      ALTER TABLE "restaurants"
        ADD COLUMN IF NOT EXISTS "print_agent_username" character varying,
        ADD COLUMN IF NOT EXISTS "print_agent_password_hash" character varying,
        ADD COLUMN IF NOT EXISTS "brand_name" character varying(120),
        ADD COLUMN IF NOT EXISTS "branch_type" character varying(32) NOT NULL DEFAULT 'independent',
        ADD COLUMN IF NOT EXISTS "franchisee_company_name" character varying(160),
        ADD COLUMN IF NOT EXISTS "royalty_rate" numeric(5,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "monthly_fee" numeric(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "billing_status" character varying(32) NOT NULL DEFAULT 'paid',
        ADD COLUMN IF NOT EXISTS "is_access_suspended" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "suspension_reason" character varying(160),
        ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "last_payment_date" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "last_paid_period" character varying(16),
        ADD COLUMN IF NOT EXISTS "billing_notes" text,
        ADD COLUMN IF NOT EXISTS "payment_history" jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);
    await this.repo.query(`
      DROP INDEX IF EXISTS "IDX_restaurants_print_agent_token_hash";
      ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "print_agent_token_hash";
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_restaurants_print_agent_username"
        ON "restaurants" ("print_agent_username")
        WHERE "print_agent_username" IS NOT NULL;
      CREATE INDEX IF NOT EXISTS "IDX_restaurants_brand_name" ON "restaurants" ("brand_name");
      CREATE INDEX IF NOT EXISTS "IDX_restaurants_billing_status" ON "restaurants" ("billing_status");
    `);
    await this.repo.query(`
      ALTER TABLE "root_admins"
        ADD COLUMN IF NOT EXISTS "boss_tier" character varying(32) NOT NULL DEFAULT 'franchise_owner',
        ADD COLUMN IF NOT EXISTS "brand_name" character varying(120);
      CREATE INDEX IF NOT EXISTS "IDX_root_admins_boss_tier" ON "root_admins" ("boss_tier");
    `);
    await this.repo.query(`
      CREATE TABLE IF NOT EXISTS "platform_billing_configs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "receiver_name" character varying(160) NOT NULL DEFAULT 'Corder Software and Technology Inc.',
        "iban" character varying(64) NOT NULL DEFAULT 'TR33 0006 1005 1978 6457 8413 26',
        "bank_name" character varying(120) NOT NULL DEFAULT 'Garanti BBVA',
        "collection_start_day" integer NOT NULL DEFAULT 25,
        "collection_end_day" integer NOT NULL DEFAULT 30,
        "support_phone" character varying(64),
        "support_email" character varying(120),
        "payment_instructions" text,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_billing_configs" PRIMARY KEY ("id")
      );
    `);
  }

  async enrichRestaurantsWithBosses(restaurants: RestaurantEntity[]) {
    if (restaurants.length === 0) return [];
    const restIds = restaurants.map((r) => r.id);
    const [links, allBosses] = await Promise.all([
      this.bossRestaurantRepo.find({ where: { restaurantId: In(restIds) } }),
      this.rootAdminRepo.find(),
    ]);
    const bossById = new Map(allBosses.map((b) => [b.id, b]));

    return restaurants.map((r) => {
      const branchLinks = links.filter((l) => l.restaurantId === r.id);
      const assignedMap = new Map<
        string,
        { id: string; name: string; email: string; bossTier: string; title: string }
      >();

      for (const link of branchLinks) {
        const b = bossById.get(link.bossId);
        if (b) {
          assignedMap.set(b.id, {
            id: b.id,
            name: b.name,
            email: b.email,
            bossTier: b.bossTier || 'franchise_owner',
            title:
              link.title ||
              (b.bossTier === 'brand_owner' ? 'Brand Owner (HQ)' : 'Franchise / Branch Owner'),
          });
        }
      }

      if (r.rootAdminId && !assignedMap.has(r.rootAdminId)) {
        const b = bossById.get(r.rootAdminId);
        if (b) {
          assignedMap.set(b.id, {
            id: b.id,
            name: b.name,
            email: b.email,
            bossTier: b.bossTier || 'franchise_owner',
            title: b.bossTier === 'brand_owner' ? 'Brand Owner (HQ)' : 'Franchise / Branch Owner',
          });
        }
      }

      if (r.brandName) {
        const normalizedBrand = r.brandName.trim().toLowerCase();
        for (const b of allBosses) {
          if (
            b.bossTier === 'brand_owner' &&
            b.brandName &&
            b.brandName.trim().toLowerCase() === normalizedBrand &&
            !assignedMap.has(b.id)
          ) {
            assignedMap.set(b.id, {
              id: b.id,
              name: b.name,
              email: b.email,
              bossTier: 'brand_owner',
              title: 'Brand Owner (HQ)',
            });
          }
        }
      }

      return {
        ...r,
        monthlyFee: Number(r.monthlyFee || 0),
        royaltyRate: Number(r.royaltyRate || 0),
        paymentHistory: Array.isArray(r.paymentHistory) ? r.paymentHistory : [],
        bosses: Array.from(assignedMap.values()),
      };
    });
  }

  async findAll() {
    const list = await this.repo.find({ order: { createdAt: 'DESC' } });
    return this.enrichRestaurantsWithBosses(list);
  }

  async findOne(id: string): Promise<RestaurantEntity> {
    const r = await this.repo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Restaurant not found');
    return r;
  }

  async findOneEnriched(id: string) {
    const r = await this.findOne(id);
    const [enriched] = await this.enrichRestaurantsWithBosses([r]);
    return enriched;
  }

  async findBySlug(slug: string): Promise<RestaurantEntity | null> {
    return this.repo.findOne({ where: { slug } });
  }

  private async autoLinkBrandOwners(restaurant: RestaurantEntity): Promise<void> {
    if (!restaurant.brandName) return;
    const brandOwners = await this.rootAdminRepo.find({
      where: { bossTier: 'brand_owner' },
    });
    const normalized = restaurant.brandName.trim().toLowerCase();
    for (const boss of brandOwners) {
      if (boss.brandName && boss.brandName.trim().toLowerCase() === normalized) {
        const existing = await this.bossRestaurantRepo.findOne({
          where: { bossId: boss.id, restaurantId: restaurant.id },
        });
        if (!existing) {
          await this.bossRestaurantRepo.save(
            this.bossRestaurantRepo.create({
              bossId: boss.id,
              restaurantId: restaurant.id,
              title: 'Brand Owner (HQ)',
            }),
          );
        }
      }
    }
  }

  async create(dto: CreateRestaurantDto) {
    const slug = dto.slug.toLowerCase().trim();
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing) throw new ConflictException('Slug already in use');
    const {
      printAgentUsername: rawUsername,
      printAgentPassword: rawPassword,
      monthlyFee,
      royaltyRate,
      brandName,
      branchType,
      franchiseeCompanyName,
      billingStatus,
      isAccessSuspended,
      billingNotes,
      ...restDto
    } = dto;
    const printAgentUsername = rawUsername?.trim().toLowerCase() || null;
    if (printAgentUsername) {
      const owner = await this.repo.findOne({ where: { printAgentUsername } });
      if (owner) throw new ConflictException('Print agent username already in use');
    }
    const printAgentPasswordHash =
      rawPassword && rawPassword.length > 0 ? await bcrypt.hash(rawPassword, 10) : null;

    const effectiveBillingStatus =
      isAccessSuspended === true ? 'suspended' : (billingStatus ?? 'paid');
    const effectiveSuspended =
      effectiveBillingStatus === 'suspended' || Boolean(isAccessSuspended);

    const entity = this.repo.create({
      ...restDto,
      slug,
      brandName: brandName?.trim() || null,
      branchType: branchType ?? 'independent',
      franchiseeCompanyName: franchiseeCompanyName?.trim() || null,
      royaltyRate: royaltyRate != null ? String(Number(royaltyRate)) : '0',
      monthlyFee: monthlyFee != null ? String(Number(monthlyFee)) : '0',
      billingStatus: effectiveBillingStatus,
      isAccessSuspended: effectiveSuspended,
      suspensionReason: effectiveSuspended ? 'payment_overdue' : null,
      suspendedAt: effectiveSuspended ? new Date() : null,
      lastPaymentDate: effectiveBillingStatus === 'paid' ? new Date() : null,
      lastPaidPeriod: effectiveBillingStatus === 'paid' ? getCurrentBillingPeriod() : null,
      billingNotes: billingNotes?.trim() || null,
      paymentHistory: [],
      printAgentUsername,
      printAgentPasswordHash,
    });
    const saved = await this.repo.save(entity);
    await this.autoLinkBrandOwners(saved);
    return this.findOneEnriched(saved.id);
  }

  async update(id: string, dto: UpdateRestaurantDto) {
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
    if (dto.brandName !== undefined) entity.brandName = dto.brandName?.trim() || null;
    if (dto.branchType !== undefined) entity.branchType = dto.branchType;
    if (dto.franchiseeCompanyName !== undefined) {
      entity.franchiseeCompanyName = dto.franchiseeCompanyName?.trim() || null;
    }
    if (dto.royaltyRate !== undefined) {
      entity.royaltyRate = String(Math.max(0, Math.min(100, Number(dto.royaltyRate) || 0)));
    }
    if (dto.monthlyFee !== undefined) {
      entity.monthlyFee = String(Math.max(0, Number(dto.monthlyFee) || 0));
    }
    if (dto.billingNotes !== undefined) {
      entity.billingNotes = dto.billingNotes?.trim() || null;
    }

    if (dto.billingStatus !== undefined || dto.isAccessSuspended !== undefined) {
      const nextStatus =
        dto.isAccessSuspended === true
          ? 'suspended'
          : (dto.billingStatus ?? entity.billingStatus);
      entity.billingStatus = nextStatus;

      if (nextStatus === 'paid') {
        entity.isAccessSuspended = false;
        entity.suspensionReason = null;
        entity.suspendedAt = null;
        entity.status = 'active';
        entity.lastPaymentDate = new Date();
        entity.lastPaidPeriod = getCurrentBillingPeriod();
      } else if (nextStatus === 'suspended' || dto.isAccessSuspended === true) {
        entity.billingStatus = 'suspended';
        entity.isAccessSuspended = true;
        entity.suspensionReason = 'payment_overdue';
        entity.suspendedAt = entity.suspendedAt ?? new Date();
      } else {
        entity.isAccessSuspended = false;
        entity.suspensionReason = null;
        entity.suspendedAt = null;
      }
    }

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
    const saved = await this.repo.save(entity);
    await this.autoLinkBrandOwners(saved);
    return this.findOneEnriched(saved.id);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.remove(entity);
  }
}
