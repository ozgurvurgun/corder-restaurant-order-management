import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { TableEntity } from '../../restaurant/domain/table.entity';
import { OrderEntity } from '../../restaurant/domain/order.entity';
import { CompletedOrderEntity } from '../../restaurant/domain/completed-order.entity';
import { CashShiftEntity } from '../../restaurant/domain/cash-shift.entity';
import { CategoryEntity } from '../../restaurant/domain/category.entity';
import { ProductEntity } from '../../restaurant/domain/product.entity';
import { PrintJobEntity } from '../../restaurant/domain/print-job.entity';
import { RestaurantStaffEntity } from '../../restaurant/domain/restaurant-staff.entity';
import { FraudAlertEntity } from '../../restaurant/domain/fraud-alert.entity';
import { LedgerCustomerEntity } from '../../restaurant/domain/ledger-customer.entity';
import { LedgerEntryEntity } from '../../restaurant/domain/ledger-entry.entity';
import { WaiterCallEntity } from '../../restaurant/domain/waiter-call.entity';
import { OrderStatusPolicy } from '../../restaurant/domain/services/order-status.policy';
import { computeIstanbulDateBoundaries } from '../../restaurant/domain/services/boss-overview.policy';
import { SESSION_LOCK_STALE_MS } from '../../restaurant/application/table.service';
import { FraudDetectionService } from '../../restaurant/application/fraud-detection.service';
import { PrintersService } from '../../restaurant/application/printers.service';
import { serializeCashShift } from '../../restaurant/application/orders/order.mapper';
import { OrdersGateway } from '../../restaurant/api/orders.gateway';
import { fromMinorUnits, toMinorUnits } from '../../common/money/minor-units';

export type SupportActionType =
  | 'clear_print_queue'
  | 'force_close_shift'
  | 'release_stuck_tables'
  | 'clear_notifications'
  | 'reset_staff_password'
  | 'toggle_staff_active';

export interface SupportActionInput {
  action: SupportActionType;
  targetId?: string;
  newPassword?: string;
}

@Injectable()
export class PlatformSupportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly fraudService: FraudDetectionService,
    private readonly printersService: PrintersService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  private async loadRevenueAgg(
    em: EntityManager,
    restaurantId: string,
    startOfToday: Date,
  ): Promise<{ totalMinor: number; todayMinor: number }> {
    if (typeof em.createQueryBuilder === 'function') {
      const row = await em
        .createQueryBuilder(CompletedOrderEntity, 'co')
        .select('COALESCE(SUM(co.net_amount), 0)', 'totalRevenue')
        .addSelect(
          'COALESCE(SUM(CASE WHEN co.closed_at >= :startOfToday THEN co.net_amount ELSE 0 END), 0)',
          'todayRevenue',
        )
        .where('co.restaurant_id = :restaurantId', { restaurantId, startOfToday })
        .getRawOne<{
          totalRevenue: string | number | null;
          todayRevenue: string | number | null;
        }>();
      return {
        totalMinor: toMinorUnits(Number(row?.totalRevenue ?? 0)),
        todayMinor: toMinorUnits(Number(row?.todayRevenue ?? 0)),
      };
    }
    const rows = await em.find(CompletedOrderEntity, {
      where: { restaurantId },
      select: ['id', 'netAmount', 'closedAt'],
    });
    let totalMinor = 0;
    let todayMinor = 0;
    for (const co of rows) {
      const m = toMinorUnits(co.netAmount || 0);
      totalMinor += m;
      if (co.closedAt >= startOfToday) todayMinor += m;
    }
    return { totalMinor, todayMinor };
  }

  private async loadLedgerReceivableMinor(
    em: EntityManager,
    restaurantId: string,
  ): Promise<number> {
    if (typeof em.createQueryBuilder === 'function') {
      const row = await em
        .createQueryBuilder(LedgerEntryEntity, 'le')
        .select(
          `COALESCE(SUM(CASE WHEN le.entry_type = 'debt' THEN le.amount::numeric ELSE -le.amount::numeric END), 0)`,
          'netReceivable',
        )
        .where('le.restaurant_id = :restaurantId', { restaurantId })
        .getRawOne<{ netReceivable: string | number | null }>();
      return toMinorUnits(Number(row?.netReceivable ?? 0));
    }
    const rows = await em.find(LedgerEntryEntity, {
      where: { restaurantId },
      select: ['entryType', 'amount'],
    });
    let minor = 0;
    for (const entry of rows) {
      const m = toMinorUnits(entry.amount || 0);
      minor += entry.entryType === 'debt' ? m : -m;
    }
    return minor;
  }

  private summarizeTables(tables: TableEntity[], now = new Date()) {
    let occupied = 0;
    let empty = 0;
    let reserved = 0;
    let checkout = 0;
    let lockedSessionsCount = 0;
    for (const t of tables) {
      if (t.status === 'occupied') occupied += 1;
      else if (t.status === 'reserved') reserved += 1;
      else if (t.status === 'checkout') {
        occupied += 1;
        checkout += 1;
      } else empty += 1;
      if (t.sessionStaffId && t.hasActiveLock(SESSION_LOCK_STALE_MS, now)) {
        lockedSessionsCount += 1;
      }
    }
    return {
      total: tables.length,
      occupied,
      empty,
      reserved,
      checkout,
      lockedSessionsCount,
    };
  }

  private enrichShift(s: CashShiftEntity) {
    const base = serializeCashShift(s);
    const expectedMinor =
      toMinorUnits(s.openingBalance || 0) +
      toMinorUnits(s.cashIn || 0) -
      toMinorUnits(s.cashOut || 0);
    const closingMinor =
      s.closingBalance != null ? toMinorUnits(s.closingBalance) : null;
    return {
      ...base,
      expectedCash: fromMinorUnits(expectedMinor),
      cashDifference:
        closingMinor != null ? fromMinorUnits(closingMinor - expectedMinor) : 0,
    };
  }

  async getDiagnostics(restaurantId: string) {
    const em = this.dataSource.manager;
    const restaurant = await em.findOne(RestaurantEntity, {
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const { startOfToday } = computeIstanbulDateBoundaries(
      new Date(),
      restaurant.autoCloseShiftTime,
      restaurant.autoCloseShiftEnabled !== false,
    );
    const [
      tables,
      activeOrdersCount,
      pendingKitchenCount,
      pendingJobsCount,
      revenueAgg,
      openShift,
      recentShifts,
      categories,
      printers,
      staffMembers,
      fraudAlerts,
      ledgerCustomerCount,
      ledgerReceivableMinor,
      unackWaiterCallsCount,
    ] = await Promise.all([
      em.find(TableEntity, { where: { restaurantId }, order: { section: 'ASC', name: 'ASC' } }),
      em.count(OrderEntity, { where: { restaurantId, status: 'active' } }),
      em.count(OrderEntity, {
        where: { restaurantId, status: 'active', kitchenTicketPrintedAt: IsNull() },
      }),
      em.count(PrintJobEntity, { where: { restaurantId, printedAt: IsNull() } }),
      this.loadRevenueAgg(em, restaurantId, startOfToday),
      em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
      }),
      em.find(CashShiftEntity, { where: { restaurantId }, order: { openedAt: 'DESC' }, take: 10 }),
      em.find(CategoryEntity, { where: { restaurantId }, select: ['id'] }),
      this.printersService.list(restaurantId),
      em.find(RestaurantStaffEntity, { where: { restaurantId }, order: { createdAt: 'ASC' } }),
      em.find(FraudAlertEntity, {
        where: { restaurantId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      em.count(LedgerCustomerEntity, { where: { restaurantId } }),
      this.loadLedgerReceivableMinor(em, restaurantId),
      em.count(WaiterCallEntity, { where: { restaurantId, acknowledged: false } }),
    ]);

    const categoryIds = categories.map((c) => c.id);
    const productsCount = categoryIds.length
      ? await em.count(ProductEntity, { where: { categoryId: In(categoryIds) } })
      : 0;

    return {
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        status: restaurant.status,
        brandName: restaurant.brandName ?? null,
        branchType: restaurant.branchType || 'independent',
        isAccessSuspended: Boolean(restaurant.isAccessSuspended),
        logoUrl: restaurant.logoUrl ?? null,
      },
      tablesSummary: this.summarizeTables(tables),
      activeOrdersCount,
      todayRevenue: fromMinorUnits(revenueAgg.todayMinor),
      totalRevenue: fromMinorUnits(revenueAgg.totalMinor),
      openShift: openShift ? this.enrichShift(openShift) : null,
      recentShifts: recentShifts.map((s) => this.enrichShift(s)),
      categoriesCount: categories.length,
      productsCount,
      printers: printers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        connection: p.connection,
        ipAddress: p.ipAddress,
        port: p.port,
        department: p.department,
        status: p.status,
        paperWidth: p.paperWidth,
      })),
      pendingPrintJobsCount: pendingJobsCount + pendingKitchenCount,
      unacknowledgedWaiterCallsCount: unackWaiterCallsCount,
      staffMembers: staffMembers.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        role: s.role,
        phone: s.phone,
        isActive: s.isActive,
        canAccessPanel: s.canAccessPanel,
        canAccessTerminal: s.canAccessTerminal,
        createdAt: s.createdAt.toISOString(),
      })),
      openFraudAlertsCount: fraudAlerts.filter(
        (a) => a.status === 'open' || a.status === 'investigating',
      ).length,
      recentFraudAlerts: fraudAlerts
        .slice(0, 10)
        .map((a) => this.fraudService.serializeAlert(a)),
      ledgerSummary: {
        customerCount: ledgerCustomerCount,
        totalReceivable: fromMinorUnits(Math.max(0, ledgerReceivableMinor)),
      },
    };
  }

  private async executeClearPrintQueue(
    em: EntityManager,
    restaurantId: string,
    now: Date,
  ): Promise<{ ok: true; action: SupportActionType; message: string }> {
    const [jobsRes, ordersRes] = await Promise.all([
      em.update(PrintJobEntity, { restaurantId, printedAt: IsNull() }, { printedAt: now }),
      em.update(
        OrderEntity,
        { restaurantId, status: 'active', kitchenTicketPrintedAt: IsNull() },
        { kitchenTicketPrintedAt: now },
      ),
    ]);
    const cleared = (jobsRes.affected ?? 0) + (ordersRes.affected ?? 0);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return {
      ok: true,
      action: 'clear_print_queue',
      message: `Bekleyen yazdırma kuyruğu temizlendi (${cleared} fiş işaretlendi).`,
    };
  }

  private async executeForceCloseShift(
    em: EntityManager,
    restaurantId: string,
    actorName: string,
  ): Promise<{ ok: true; action: SupportActionType; message: string }> {
    const runForceClose = async (txEm: EntityManager) => {
      const openShift = await txEm.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!openShift) return null;
      const expectedMinor =
        toMinorUnits(openShift.openingBalance || 0) +
        toMinorUnits(openShift.cashIn || 0) -
        toMinorUnits(openShift.cashOut || 0);
      openShift.closeShift(
        actorName,
        Math.max(0, expectedMinor),
        'Platform destek konsolu üzerinden kapatıldı',
      );
      await txEm.save(CashShiftEntity, openShift);
      return openShift.openedBy;
    };
    const openedBy =
      typeof this.dataSource.transaction === 'function'
        ? await this.dataSource.transaction(runForceClose)
        : await runForceClose(em);
    if (!openedBy) {
      return {
        ok: true,
        action: 'force_close_shift',
        message: 'Bu şubede açık vardiya bulunmuyor.',
      };
    }
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return {
      ok: true,
      action: 'force_close_shift',
      message: `Açık kasa vardiyası (${openedBy}) güvenli şekilde kapatıldı.`,
    };
  }

  private async executeReleaseStuckTables(
    em: EntityManager,
    restaurantId: string,
  ): Promise<{ ok: true; action: SupportActionType; message: string }> {
    const runReleaseTables = async (txEm: EntityManager) => {
      const tables = await txEm.find(TableEntity, {
        where: { restaurantId },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      const activeOrders = await txEm.find(OrderEntity, {
        where: { restaurantId, status: 'active' },
        relations: ['items'],
      });
      const billableTableIds = new Set<string>();
      for (const ord of activeOrders) {
        const hasBillable = (ord.items ?? []).some((i) =>
          OrderStatusPolicy.isItemOnActiveBill(i.status),
        );
        if (hasBillable) billableTableIds.add(ord.tableId);
      }

      const changedTables: TableEntity[] = [];
      for (const table of tables) {
        let changed = false;
        if (table.sessionStaffId || table.sessionLockedAt) {
          table.releaseSession();
          changed = true;
        }
        if (table.status === 'checkout') {
          table.status = billableTableIds.has(table.id) ? 'occupied' : 'empty';
          changed = true;
        } else if (table.status === 'occupied' && !billableTableIds.has(table.id)) {
          table.markEmpty();
          changed = true;
        }
        if (changed) changedTables.push(table);
      }
      if (changedTables.length > 0) {
        await txEm.save(TableEntity, changedTables);
      }
      return changedTables.length;
    };
    const releasedCount =
      typeof this.dataSource.transaction === 'function'
        ? await this.dataSource.transaction(runReleaseTables)
        : await runReleaseTables(em);
    await this.ordersGateway
      .emitTableSessionPresence(restaurantId)
      .catch(() => undefined);
    this.ordersGateway.emitOrdersUpdated(restaurantId);
    return {
      ok: true,
      action: 'release_stuck_tables',
      message: `${releasedCount} masanın oturum kilidi / takılı durumu sıfırlandı.`,
    };
  }

  private async executeResetStaffPassword(
    em: EntityManager,
    restaurantId: string,
    dto: SupportActionInput,
  ): Promise<{ ok: true; action: SupportActionType; message: string }> {
    if (!dto.targetId?.trim()) {
      throw new BadRequestException('targetId (staffId) is required');
    }
    const staff = await em.findOne(RestaurantStaffEntity, {
      where: { id: dto.targetId.trim(), restaurantId },
    });
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
    const nextSecret = (dto.newPassword ?? '').trim();
    if (nextSecret.length < 4) {
      throw new BadRequestException(
        'newPassword is required and must be at least 4 characters',
      );
    }
    const hashed = await bcrypt.hash(nextSecret, 10);
    staff.passwordHash = hashed;
    if (/^\d{4,8}$/.test(nextSecret)) {
      staff.pinHash = hashed;
    }
    await em.save(RestaurantStaffEntity, staff);
    this.ordersGateway.emitStaffSessionUpdated(restaurantId, staff.id);
    return {
      ok: true,
      action: 'reset_staff_password',
      message: `${staff.name} personelinin parola/PIN bilgisi güncellendi.`,
    };
  }

  private async executeToggleStaffActive(
    em: EntityManager,
    restaurantId: string,
    dto: SupportActionInput,
  ): Promise<{ ok: true; action: SupportActionType; message: string }> {
    if (!dto.targetId?.trim()) {
      throw new BadRequestException('targetId (staffId) is required');
    }
    const staff = await em.findOne(RestaurantStaffEntity, {
      where: { id: dto.targetId.trim(), restaurantId },
    });
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
    staff.isActive = !staff.isActive;
    await em.save(RestaurantStaffEntity, staff);
    this.ordersGateway.emitStaffSessionUpdated(restaurantId, staff.id);
    return {
      ok: true,
      action: 'toggle_staff_active',
      message: `${staff.name} durumu ${staff.isActive ? 'Aktif' : 'Pasif'} olarak değiştirildi.`,
    };
  }

  async executeSupportAction(
    restaurantId: string,
    dto: SupportActionInput,
    actorName = 'Platform Admin',
  ): Promise<{ ok: true; action: SupportActionType; message: string }> {
    const em = this.dataSource.manager;
    const restaurant = await em.findOne(RestaurantEntity, {
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    const now = new Date();
    switch (dto.action) {
      case 'clear_print_queue':
        return this.executeClearPrintQueue(em, restaurantId, now);
      case 'force_close_shift':
        return this.executeForceCloseShift(em, restaurantId, actorName);
      case 'release_stuck_tables':
        return this.executeReleaseStuckTables(em, restaurantId);
      case 'clear_notifications':
        restaurant.notificationsClearedAt = now;
        restaurant.dismissedNotificationIds = [];
        await Promise.all([
          em.save(RestaurantEntity, restaurant),
          em.update(
            WaiterCallEntity,
            { restaurantId, acknowledged: false },
            { acknowledged: true },
          ),
        ]);
        this.ordersGateway.emitNotificationsUpdated(restaurantId);
        return {
          ok: true,
          action: dto.action,
          message: 'Tüm şube bildirimleri ve garson çağrıları temizlendi.',
        };
      case 'reset_staff_password':
        return this.executeResetStaffPassword(em, restaurantId, dto);
      case 'toggle_staff_active':
        return this.executeToggleStaffActive(em, restaurantId, dto);
      default:
        throw new BadRequestException('Unsupported support action');
    }
  }
}
