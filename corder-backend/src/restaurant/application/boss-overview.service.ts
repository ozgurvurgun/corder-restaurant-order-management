import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { BossTier, RootAdminEntity } from '../../platform/domain/root-admin.entity';
import { BossRestaurantEntity } from '../../platform/domain/boss-restaurant.entity';
import { TableEntity } from '../domain/table.entity';
import { OrderEntity } from '../domain/order.entity';
import { OrderItemEntity } from '../domain/order-item.entity';
import { CompletedOrderEntity } from '../domain/completed-order.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { StockMaterialEntity } from '../domain/stock-material.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { LedgerEntryEntity } from '../domain/ledger-entry.entity';
import { AuditLogEntity } from '../domain/audit-log.entity';
import { RestaurantRoleEntity } from '../domain/restaurant-role.entity';
import {
  BossOverviewPolicy,
  BranchLivePulseDto,
  computeIstanbulDateBoundaries,
} from '../domain/services/boss-overview.policy';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';
import { normalizeStorageText } from '../../common/text/text-normalizer';
import { RestaurantAuthService } from './restaurant-auth.service';
import { RolesService } from './roles.service';

export { BranchLivePulseDto } from '../domain/services/boss-overview.policy';

@Injectable()
export class BossOverviewService {
  constructor(
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(BossRestaurantEntity)
    private readonly bossRestaurantRepo: Repository<BossRestaurantEntity>,
    @InjectRepository(TableEntity)
    private readonly tableRepo: Repository<TableEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepo: Repository<OrderItemEntity>,
    @InjectRepository(CompletedOrderEntity)
    private readonly completedOrderRepo: Repository<CompletedOrderEntity>,
    @InjectRepository(CashShiftEntity)
    private readonly shiftRepo: Repository<CashShiftEntity>,
    @InjectRepository(StockMaterialEntity)
    private readonly stockRepo: Repository<StockMaterialEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
    @InjectRepository(LedgerEntryEntity)
    private readonly ledgerEntryRepo: Repository<LedgerEntryEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
    @InjectRepository(RestaurantRoleEntity)
    private readonly roleRepo: Repository<RestaurantRoleEntity>,
    private readonly authService: RestaurantAuthService,
    private readonly rolesService: RolesService,
  ) {}

  async getOverview(bossId: string, branchIdFilter?: string) {
    const ownedBranches = await this.loadBossOwnedBranches(bossId);
    const targetBranches: RestaurantEntity[] =
      branchIdFilter && branchIdFilter !== 'ALL'
        ? ownedBranches.filter((b) => b.id === branchIdFilter)
        : ownedBranches;

    if (targetBranches.length === 0) {
      return {
        branches: [],
        allOwnedBranches: [],
        consolidated: BossOverviewPolicy.emptyConsolidated(),
        hourlySales: [],
        topProducts: [],
        staffPerformance: [],
        criticalMaterials: [],
        recentAudits: [],
      };
    }

    const { startOfToday, startOfWeek, startOfMonth } =
      computeIstanbulDateBoundaries(new Date());
    const branchIds = targetBranches.map((b) => b.id);
    const data = await this.loadBranchesRawData(branchIds, startOfMonth);

    const branchPulses: BranchLivePulseDto[] = targetBranches.map((branch) =>
      BossOverviewPolicy.buildBranchPulse({
        branch,
        ...data,
        startOfToday,
        startOfWeek,
        startOfMonth,
      }),
    );

    const { topProducts, staffPerformance } =
      BossOverviewPolicy.buildTopProductsAndStaffPerformance(data.completedMonth);
    const branchNameById = new Map(ownedBranches.map((b) => [b.id, b.name]));

    return {
      branches: branchPulses,
      allOwnedBranches: ownedBranches.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        status: b.status,
        brandName: b.brandName ?? null,
        branchType: b.branchType || 'independent',
        franchiseeCompanyName: b.franchiseeCompanyName ?? null,
        royaltyRate: Number(b.royaltyRate || 0),
        monthlyFee: Number(b.monthlyFee || 0),
        billingStatus: b.billingStatus || 'paid',
        isAccessSuspended: Boolean(b.isAccessSuspended),
      })),
      consolidated: BossOverviewPolicy.computeConsolidatedMetrics(branchPulses),
      hourlySales: BossOverviewPolicy.buildHourlySales(data.completedMonth, startOfToday),
      topProducts,
      staffPerformance,
      criticalMaterials: BossOverviewPolicy.buildCriticalMaterials(
        data.materials,
        branchNameById,
      ),
      recentAudits: BossOverviewPolicy.buildRecentAudits(
        data.recentAudits,
        branchNameById,
      ),
    };
  }

  async listBranchBosses(bossId: string) {
    const ownedBranches = await this.loadBossOwnedBranches(bossId);
    if (ownedBranches.length === 0) return [];
    const branchIds = ownedBranches.map((b) => b.id);
    const branchMap = new Map(ownedBranches.map((b) => [b.id, b]));
    const links = await this.bossRestaurantRepo.find({
      where: { restaurantId: In(branchIds) },
      order: { createdAt: 'ASC' },
    });
    const bossIds = Array.from(new Set(links.map((l) => l.bossId)));
    if (bossIds.length === 0) return [];
    const bosses = await this.rootAdminRepo.find({
      where: { id: In(bossIds) },
      order: { createdAt: 'ASC' },
    });

    return bosses.map((b) => {
      const bLinks = links.filter((l) => l.bossId === b.id);
      return {
        id: b.id,
        name: b.name,
        email: b.email,
        phone: b.phone ?? null,
        bossTier: b.bossTier || 'franchise_owner',
        brandName: b.brandName ?? null,
        isSelf: b.id === bossId,
        branches: bLinks
          .map((l) => {
            const br = branchMap.get(l.restaurantId);
            return br
              ? {
                  id: br.id,
                  name: br.name,
                  slug: br.slug,
                  branchType: br.branchType || 'independent',
                  title: l.title,
                }
              : null;
          })
          .filter(Boolean),
      };
    });
  }

  async createOrAssignBranchBoss(
    actorBossId: string,
    dto: {
      name: string;
      email: string;
      phone?: string;
      password?: string;
      bossTier?: 'franchise_owner' | 'regional_manager';
      restaurantIds: string[];
    },
  ) {
    const ownedBranches = await this.loadBossOwnedBranches(actorBossId);
    const ownedIds = new Set(ownedBranches.map((b) => b.id));
    const targetIds = Array.from(
      new Set((dto.restaurantIds ?? []).filter((id) => ownedIds.has(id))),
    );
    if (targetIds.length === 0) {
      throw new BadRequestException('Please select at least one authorized branch');
    }

    const email = dto.email.toLowerCase().trim();
    const tier: BossTier = dto.bossTier ?? 'franchise_owner';
    const title =
      tier === 'regional_manager' ? 'Regional Manager' : 'Franchise / Branch Owner';

    let subBoss = await this.rootAdminRepo.findOne({ where: { email } });
    if (subBoss) {
      if (subBoss.id === actorBossId) {
        throw new ConflictException('You cannot assign your own account as a subordinate branch manager');
      }
      if (subBoss.bossTier === 'brand_owner') {
        throw new ForbiddenException('Brand Owner (HQ) account cannot be modified or reassigned');
      }
      if (subBoss.restaurantId && !ownedIds.has(subBoss.restaurantId)) {
        throw new ConflictException(
          'An account with this email already exists in another organization',
        );
      }
      const existingSubLinks = await this.bossRestaurantRepo.find({
        where: { bossId: subBoss.id },
      });
      if (existingSubLinks.some((l) => !ownedIds.has(l.restaurantId))) {
        throw new ConflictException(
          'This boss account is linked to branches outside your authority',
        );
      }
      if (dto.name?.trim()) subBoss.name = normalizeStorageText(dto.name);
      if (dto.phone !== undefined) subBoss.phone = dto.phone?.trim() || null;
      if (dto.password && dto.password.length >= 8) {
        subBoss.passwordHash = await bcrypt.hash(dto.password, 10);
      }
      await this.rootAdminRepo.save(subBoss);
    } else {
      if (!dto.password || dto.password.length < 8) {
        throw new BadRequestException('A password of at least 8 characters is required for a new Branch / Franchise Boss account');
      }
      const passwordHash = await bcrypt.hash(dto.password, 10);
      subBoss = await this.rootAdminRepo.save(
        this.rootAdminRepo.create({
          restaurantId: targetIds[0],
          email,
          name: normalizeStorageText(dto.name),
          phone: dto.phone?.trim() || null,
          bossTier: tier,
          isActive: true,
          passwordHash,
        }),
      );
    }

    for (const rId of targetIds) {
      const existing = await this.bossRestaurantRepo.findOne({
        where: { bossId: subBoss.id, restaurantId: rId },
      });
      if (!existing) {
        await this.bossRestaurantRepo.save(
          this.bossRestaurantRepo.create({
            bossId: subBoss.id,
            restaurantId: rId,
            title,
          }),
        );
      }
    }

    return this.listBranchBosses(actorBossId);
  }

  async unlinkBranchBoss(
    actorBossId: string,
    targetBossId: string,
    branchId: string,
  ) {
    if (actorBossId === targetBossId) {
      throw new BadRequestException('You cannot unlink your own account from a branch');
    }
    const ownedBranches = await this.loadBossOwnedBranches(actorBossId);
    if (!ownedBranches.some((b) => b.id === branchId)) {
      throw new ForbiddenException('You do not have authority over this branch');
    }
    const target = await this.rootAdminRepo.findOne({ where: { id: targetBossId } });
    if (!target) throw new NotFoundException('Boss account not found');
    if (target.bossTier === 'brand_owner') {
      throw new ForbiddenException('Brand Owner (HQ) cannot be unlinked from a branch');
    }
    await this.bossRestaurantRepo.delete({
      bossId: targetBossId,
      restaurantId: branchId,
    });
    return this.listBranchBosses(actorBossId);
  }

  async syncRolesAcrossBranches(
    bossId: string,
    sourceRestaurantId: string,
    targetRestaurantIds?: string[],
  ): Promise<{ syncedBranches: number; syncedRoles: number }> {
    const ownedBranches = await this.loadBossOwnedBranches(bossId);
    const ownedIds = new Set(ownedBranches.map((b) => b.id));
    if (!ownedIds.has(sourceRestaurantId)) {
      throw new ForbiddenException('Source branch does not belong to this Boss');
    }

    const sourceRoles = await this.rolesService.ensureDefaultRoles(sourceRestaurantId);
    const targets =
      targetRestaurantIds && targetRestaurantIds.length > 0
        ? targetRestaurantIds.filter((id) => ownedIds.has(id) && id !== sourceRestaurantId)
        : ownedBranches.map((b) => b.id).filter((id) => id !== sourceRestaurantId);

    let syncedRoles = 0;
    for (const targetRestId of targets) {
      syncedRoles += await this.syncBranchRoles(targetRestId, sourceRoles);
    }
    return { syncedBranches: targets.length, syncedRoles };
  }

  private async loadBossOwnedBranches(bossId: string): Promise<RestaurantEntity[]> {
    const admin = await this.rootAdminRepo.findOne({ where: { id: bossId } });
    if (!admin || admin.isActive === false) {
      throw new ForbiddenException('Boss account not found or inactive');
    }
    return this.authService.getBossOwnedRestaurants(
      bossId,
      admin.restaurantId,
      admin,
    );
  }

  private async loadBranchesRawData(branchIds: string[], startOfMonth: Date) {
    const [
      tables,
      activeOrders,
      completedMonth,
      openShifts,
      materials,
      staffList,
      ledgerAggRows,
      recentAudits,
    ] = await Promise.all([
      this.tableRepo.find({ where: { restaurantId: In(branchIds) } }),
      this.orderRepo.find({ where: { restaurantId: In(branchIds), status: 'active' } }),
      this.completedOrderRepo.find({
        where: { restaurantId: In(branchIds), closedAt: MoreThanOrEqual(startOfMonth) },
        order: { closedAt: 'DESC' },
      }),
      this.shiftRepo.find({
        where: { restaurantId: In(branchIds), status: 'open' },
        order: { openedAt: 'DESC' },
      }),
      this.stockRepo.find({ where: { restaurantId: In(branchIds) } }),
      this.staffRepo.find({ where: { restaurantId: In(branchIds), isActive: true } }),
      this.ledgerEntryRepo
        .createQueryBuilder('e')
        .select('e.restaurant_id', 'restaurantId')
        .addSelect(
          `SUM(CASE WHEN e.entry_type = 'debt' THEN e.amount::numeric ELSE -e.amount::numeric END)`,
          'netBalance',
        )
        .where('e.restaurant_id IN (:...branchIds)', { branchIds })
        .groupBy('e.restaurant_id')
        .getRawMany<{ restaurantId: string; netBalance: string | null }>(),
      this.auditRepo.find({
        where: { restaurantId: In(branchIds) },
        order: { createdAt: 'DESC' },
        take: 40,
      }),
    ]);

    const openLedgerBalanceByBranchId = new Map<string, number>();
    for (const row of ledgerAggRows) {
      const minor = Math.max(0, toMinorUnits(Number(row.netBalance || 0)));
      openLedgerBalanceByBranchId.set(row.restaurantId, fromMinorUnits(minor));
    }

    const activeOrderIds = activeOrders.map((o) => o.id);
    const activeOrderItems = activeOrderIds.length
      ? await this.orderItemRepo.find({ where: { orderId: In(activeOrderIds) } })
      : [];

    const itemsByOrderId = new Map<string, OrderItemEntity[]>();
    for (const item of activeOrderItems) {
      const list = itemsByOrderId.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrderId.set(item.orderId, list);
    }

    return {
      tables,
      activeOrders,
      itemsByOrderId,
      completedMonth,
      openShifts,
      materials,
      staffList,
      openLedgerBalanceByBranchId,
      recentAudits,
    };
  }

  private async syncBranchRoles(
    targetRestId: string,
    sourceRoles: RestaurantRoleEntity[],
  ): Promise<number> {
    await this.rolesService.ensureDefaultRoles(targetRestId);
    const targetRoles = await this.roleRepo.find({
      where: { restaurantId: targetRestId },
    });
    const targetByKey = new Map(targetRoles.map((r) => [r.key, r]));

    for (const src of sourceRoles) {
      const existing = targetByKey.get(src.key);
      const rolePayload = {
        name: src.name,
        description: src.description,
        color: src.color,
        canAccessPanel: src.canAccessPanel,
        canAccessTerminal: src.canAccessTerminal,
        permissions: [...src.permissions],
        maxDiscountPercent: src.maxDiscountPercent,
        maxDiscountAmount: src.maxDiscountAmount,
      };
      if (existing) {
        Object.assign(existing, rolePayload);
        await this.roleRepo.save(existing);
      } else {
        await this.roleRepo.save(
          this.roleRepo.create({
            restaurantId: targetRestId,
            key: src.key,
            isSystem: src.isSystem,
            ...rolePayload,
          }),
        );
      }
    }
    return sourceRoles.length;
  }
}
