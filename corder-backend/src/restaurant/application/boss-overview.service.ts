import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { TableEntity } from '../domain/table.entity';
import { OrderEntity } from '../domain/order.entity';
import { OrderItemEntity } from '../domain/order-item.entity';
import { CompletedOrderEntity } from '../domain/completed-order.entity';
import { CashShiftEntity } from '../domain/cash-shift.entity';
import { StockMaterialEntity } from '../domain/stock-material.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { LedgerEntryEntity } from '../domain/ledger-entry.entity';
import { AuditLogEntity } from '../domain/audit-log.entity';
import {
  BossOverviewPolicy,
  BranchLivePulseDto,
  computeIstanbulDateBoundaries,
} from '../domain/services/boss-overview.policy';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';
import { BossHierarchyService } from './boss-hierarchy.service';

export { BranchLivePulseDto } from '../domain/services/boss-overview.policy';

@Injectable()
export class BossOverviewService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CompletedOrderEntity)
    private readonly completedOrderRepo: Repository<CompletedOrderEntity>,
    @InjectRepository(StockMaterialEntity)
    private readonly stockRepo: Repository<StockMaterialEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
    private readonly hierarchyService: BossHierarchyService,
  ) {}

  async getOverview(bossId: string, branchIdFilter?: string) {
    const ownedBranches = await this.hierarchyService.loadBossOwnedBranches(bossId);
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

  private async loadBranchesRawData(branchIds: string[], startOfMonth: Date) {
    const em = this.dataSource.manager;
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
      em.find(TableEntity, { where: { restaurantId: In(branchIds) } }),
      em.find(OrderEntity, { where: { restaurantId: In(branchIds), status: 'active' } }),
      this.completedOrderRepo.find({
        where: { restaurantId: In(branchIds), closedAt: MoreThanOrEqual(startOfMonth) },
        order: { closedAt: 'DESC' },
      }),
      em.find(CashShiftEntity, {
        where: { restaurantId: In(branchIds), status: 'open' },
        order: { openedAt: 'DESC' },
      }),
      this.stockRepo.find({ where: { restaurantId: In(branchIds) } }),
      em.find(RestaurantStaffEntity, { where: { restaurantId: In(branchIds), isActive: true } }),
      em
        .createQueryBuilder(LedgerEntryEntity, 'e')
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
      ? await em.find(OrderItemEntity, { where: { orderId: In(activeOrderIds) } })
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
}
