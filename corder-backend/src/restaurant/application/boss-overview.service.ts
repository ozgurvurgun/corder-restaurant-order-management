import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { RootAdminEntity } from '../../platform/domain/root-admin.entity';
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
import { BossOverviewPolicy, BranchLivePulseDto } from '../domain/services/boss-overview.policy';
import { RestaurantAuthService } from './restaurant-auth.service';
import { RolesService } from './roles.service';

export { BranchLivePulseDto } from '../domain/services/boss-overview.policy';

@Injectable()
export class BossOverviewService {
  constructor(
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
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

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
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
      })),
      consolidated: BossOverviewPolicy.computeConsolidatedMetrics(branchPulses),
      hourlySales: BossOverviewPolicy.buildHourlySales(data.completedMonth, startOfToday),
      topProducts,
      staffPerformance,
      criticalMaterials: BossOverviewPolicy.buildCriticalMaterials(data.materials, branchNameById),
      recentAudits: BossOverviewPolicy.buildRecentAudits(data.recentAudits, branchNameById),
    };
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
    return this.authService.getBossOwnedRestaurants(bossId, admin.restaurantId);
  }

  private async loadBranchesRawData(branchIds: string[], startOfMonth: Date) {
    const [tables, activeOrders, completedMonth, openShifts, materials, staffList, ledgerEntries, recentAudits] =
      await Promise.all([
        this.tableRepo.find({ where: { restaurantId: In(branchIds) } }),
        this.orderRepo.find({ where: { restaurantId: In(branchIds), status: 'active' } }),
        this.completedOrderRepo.find({
          where: { restaurantId: In(branchIds), closedAt: MoreThanOrEqual(startOfMonth) },
          order: { closedAt: 'DESC' },
        }),
        this.shiftRepo.find({ where: { restaurantId: In(branchIds), status: 'open' }, order: { openedAt: 'DESC' } }),
        this.stockRepo.find({ where: { restaurantId: In(branchIds) } }),
        this.staffRepo.find({ where: { restaurantId: In(branchIds), isActive: true } }),
        this.ledgerEntryRepo.find({ where: { restaurantId: In(branchIds) } }),
        this.auditRepo.find({ where: { restaurantId: In(branchIds) }, order: { createdAt: 'DESC' }, take: 40 }),
      ]);

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

    return { tables, activeOrders, itemsByOrderId, completedMonth, openShifts, materials, staffList, ledgerEntries, recentAudits };
  }

  private async syncBranchRoles(targetRestId: string, sourceRoles: RestaurantRoleEntity[]): Promise<number> {
    await this.rolesService.ensureDefaultRoles(targetRestId);
    const targetRoles = await this.roleRepo.find({ where: { restaurantId: targetRestId } });
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
          this.roleRepo.create({ restaurantId: targetRestId, key: src.key, isSystem: src.isSystem, ...rolePayload }),
        );
      }
    }
    return sourceRoles.length;
  }
}
