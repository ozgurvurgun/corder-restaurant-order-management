import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RestaurantEntity } from '../domain/restaurant.entity';
import { TableEntity } from '../../restaurant/domain/table.entity';
import { OrderEntity } from '../../restaurant/domain/order.entity';
import { OrderItemEntity } from '../../restaurant/domain/order-item.entity';
import { CompletedOrderEntity } from '../../restaurant/domain/completed-order.entity';
import { CashShiftEntity } from '../../restaurant/domain/cash-shift.entity';
import { CategoryEntity } from '../../restaurant/domain/category.entity';
import { ProductEntity } from '../../restaurant/domain/product.entity';
import { PrinterConfigEntity } from '../../restaurant/domain/printer-config.entity';
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
    private readonly ordersGateway: OrdersGateway,
  ) {}

  async getDiagnostics(restaurantId: string) {
    const em = this.dataSource.manager;
    const restaurant = await em.findOne(RestaurantEntity, {
      where: { id: restaurantId },
    });
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found');
    }

    await this.fraudService
      .analyzeRestaurantAnomalies(restaurantId)
      .catch(() => 0);

    const { startOfToday } = computeIstanbulDateBoundaries(new Date());
    const [
      tables,
      activeOrdersCount,
      pendingKitchenCount,
      pendingJobsCount,
      completedOrders,
      openShift,
      recentShifts,
      categories,
      printers,
      staffMembers,
      fraudAlerts,
      ledgerCustomerCount,
      ledgerEntries,
      unackWaiterCallsCount,
    ] = await Promise.all([
      em.find(TableEntity, {
        where: { restaurantId },
        order: { section: 'ASC', name: 'ASC' },
      }),
      em.count(OrderEntity, { where: { restaurantId, status: 'active' } }),
      em.count(OrderEntity, {
        where: {
          restaurantId,
          status: 'active',
          kitchenTicketPrintedAt: IsNull(),
        },
      }),
      em.count(PrintJobEntity, {
        where: { restaurantId, printedAt: IsNull() },
      }),
      em.find(CompletedOrderEntity, {
        where: { restaurantId },
        select: ['id', 'netAmount', 'closedAt'],
      }),
      em.findOne(CashShiftEntity, {
        where: { restaurantId, status: 'open' },
        order: { openedAt: 'DESC' },
      }),
      em.find(CashShiftEntity, {
        where: { restaurantId },
        order: { openedAt: 'DESC' },
        take: 10,
      }),
      em.find(CategoryEntity, {
        where: { restaurantId },
        select: ['id'],
      }),
      em.find(PrinterConfigEntity, {
        where: { restaurantId },
        order: { createdAt: 'DESC' },
      }),
      em.find(RestaurantStaffEntity, {
        where: { restaurantId },
        order: { createdAt: 'ASC' },
      }),
      em.find(FraudAlertEntity, {
        where: { restaurantId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      em.count(LedgerCustomerEntity, { where: { restaurantId } }),
      em.find(LedgerEntryEntity, {
        where: { restaurantId },
        select: ['entryType', 'amount'],
      }),
      em.count(WaiterCallEntity, {
        where: { restaurantId, acknowledged: false },
      }),
    ]);

    const categoryIds = categories.map((c) => c.id);
    const productsCount = categoryIds.length
      ? await em.count(ProductEntity, { where: { categoryId: In(categoryIds) } })
      : 0;

    const now = new Date();
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

    let todayRevenueMinor = 0;
    let totalRevenueMinor = 0;
    for (const co of completedOrders) {
      const m = toMinorUnits(co.netAmount || 0);
      totalRevenueMinor += m;
      if (co.closedAt >= startOfToday) {
        todayRevenueMinor += m;
      }
    }

    let ledgerReceivableMinor = 0;
    for (const entry of ledgerEntries) {
      const m = toMinorUnits(entry.amount || 0);
      ledgerReceivableMinor += entry.entryType === 'debt' ? m : -m;
    }

    const openFraudAlertsCount = fraudAlerts.filter(
      (a) => a.status === 'open' || a.status === 'investigating',
    ).length;

    const enrichShift = (s: CashShiftEntity) => {
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
          closingMinor != null
            ? fromMinorUnits(closingMinor - expectedMinor)
            : 0,
      };
    };

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
      tablesSummary: {
        total: tables.length,
        occupied,
        empty,
        reserved,
        checkout,
        lockedSessionsCount,
      },
      activeOrdersCount,
      todayRevenue: fromMinorUnits(todayRevenueMinor),
      totalRevenue: fromMinorUnits(totalRevenueMinor),
      openShift: openShift ? enrichShift(openShift) : null,
      recentShifts: recentShifts.map(enrichShift),
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
      openFraudAlertsCount,
      recentFraudAlerts: fraudAlerts
        .slice(0, 10)
        .map((a) => this.fraudService.serializeAlert(a)),
      ledgerSummary: {
        customerCount: ledgerCustomerCount,
        totalReceivable: fromMinorUnits(Math.max(0, ledgerReceivableMinor)),
      },
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
      case 'clear_print_queue': {
        const [jobsRes, ordersRes] = await Promise.all([
          em.update(
            PrintJobEntity,
            { restaurantId, printedAt: IsNull() },
            { printedAt: now },
          ),
          em.update(
            OrderEntity,
            {
              restaurantId,
              status: 'active',
              kitchenTicketPrintedAt: IsNull(),
            },
            { kitchenTicketPrintedAt: now },
          ),
        ]);
        const cleared = (jobsRes.affected ?? 0) + (ordersRes.affected ?? 0);
        this.ordersGateway.emitOrdersUpdated(restaurantId);
        return {
          ok: true,
          action: dto.action,
          message: `Bekleyen yazdırma kuyruğu temizlendi (${cleared} fiş işaretlendi).`,
        };
      }

      case 'force_close_shift': {
        const openShift = await em.findOne(CashShiftEntity, {
          where: { restaurantId, status: 'open' },
          order: { openedAt: 'DESC' },
        });
        if (!openShift) {
          return {
            ok: true,
            action: dto.action,
            message: 'Bu şubede açık vardiya bulunmuyor.',
          };
        }
        const expectedMinor =
          toMinorUnits(openShift.openingBalance || 0) +
          toMinorUnits(openShift.cashIn || 0) -
          toMinorUnits(openShift.cashOut || 0);
        openShift.closeShift(
          actorName,
          Math.max(0, expectedMinor),
          'Platform destek konsolu üzerinden kapatıldı',
        );
        await em.save(CashShiftEntity, openShift);
        this.ordersGateway.emitOrdersUpdated(restaurantId);
        return {
          ok: true,
          action: dto.action,
          message: `Açık kasa vardiyası (${openShift.openedBy}) güvenli şekilde kapatıldı.`,
        };
      }

      case 'release_stuck_tables': {
        const [tables, activeOrders] = await Promise.all([
          em.find(TableEntity, { where: { restaurantId } }),
          em.find(OrderEntity, {
            where: { restaurantId, status: 'active' },
            relations: ['items'],
          }),
        ]);
        const billableTableIds = new Set<string>();
        for (const ord of activeOrders) {
          const hasBillable = (ord.items ?? []).some((i) =>
            OrderStatusPolicy.isItemOnActiveBill(i.status),
          );
          if (hasBillable) billableTableIds.add(ord.tableId);
        }

        let releasedCount = 0;
        for (const table of tables) {
          let changed = false;
          if (table.sessionStaffId || table.sessionLockedAt) {
            table.releaseSession();
            changed = true;
          }
          if (table.status === 'checkout') {
            table.status = billableTableIds.has(table.id)
              ? 'occupied'
              : 'empty';
            changed = true;
          } else if (
            table.status === 'occupied' &&
            !billableTableIds.has(table.id)
          ) {
            table.markEmpty();
            changed = true;
          }
          if (changed) {
            await em.save(TableEntity, table);
            releasedCount += 1;
          }
        }
        await this.ordersGateway
          .emitTableSessionPresence(restaurantId)
          .catch(() => undefined);
        this.ordersGateway.emitOrdersUpdated(restaurantId);
        return {
          ok: true,
          action: dto.action,
          message: `${releasedCount} masanın oturum kilidi / takılı durumu sıfırlandı.`,
        };
      }

      case 'clear_notifications': {
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
      }

      case 'reset_staff_password': {
        if (!dto.targetId?.trim()) {
          throw new BadRequestException('targetId (staffId) is required');
        }
        const staff = await em.findOne(RestaurantStaffEntity, {
          where: { id: dto.targetId.trim(), restaurantId },
        });
        if (!staff) {
          throw new NotFoundException('Staff member not found');
        }
        const nextSecret = (dto.newPassword ?? '').trim() || '123456';
        const hashed = await bcrypt.hash(nextSecret, 10);
        staff.passwordHash = hashed;
        if (/^\d{4,8}$/.test(nextSecret)) {
          staff.pinHash = hashed;
        }
        await em.save(RestaurantStaffEntity, staff);
        return {
          ok: true,
          action: dto.action,
          message: `${staff.name} personelinin parola/PIN bilgisi güncellendi.`,
        };
      }

      case 'toggle_staff_active': {
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
        return {
          ok: true,
          action: dto.action,
          message: `${staff.name} durumu ${staff.isActive ? 'Aktif' : 'Pasif'} olarak değiştirildi.`,
        };
      }

      default:
        throw new BadRequestException('Unsupported support action');
    }
  }
}
