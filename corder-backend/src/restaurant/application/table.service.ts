import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableEntity } from '../domain/table.entity';
import { OrderEntity } from '../domain/order.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { OrderStatusPolicy } from '../domain/services/order-status.policy';
import {
  CheckSettlementPolicy,
  SettlementActorPolicy,
} from '../domain/services/check-settlement.policy';
import { TableQrTokenPolicy } from '../domain/services/table-qr-token.policy';
import { BulkCreateTablesDto, CreateTableDto } from '../api/dto/create-table.dto';
import { UpdateTableDto } from '../api/dto/update-table.dto';
import { computeDiscountMinorUnits, toMinorUnits } from '../../common/money/minor-units';
import { normalizeStorageText } from '../../common/text/text-normalizer';

/** Grace period (ms) to automatically take over a stale lock after disconnect. */
export const SESSION_LOCK_STALE_MS = 120_000;

@Injectable()
export class TableService {
  constructor(
    @InjectRepository(TableEntity)
    private readonly repo: Repository<TableEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
  ) {}

  private sanitizeStaleLock(table: TableEntity, now: Date = new Date()): TableEntity {
    if (table.sessionStaffId && !table.hasActiveLock(SESSION_LOCK_STALE_MS, now)) {
      table.releaseSession();
    }
    table.qrToken = TableQrTokenPolicy.generateToken(table.restaurantId, table.id);
    return table;
  }

  async getBillableSubtotalMinorUnits(
    restaurantId: string,
    tableId: string,
    em: Repository<TableEntity>['manager'] = this.repo.manager,
  ): Promise<number> {
    const activeOrders = await em.find(OrderEntity, {
      where: { restaurantId, tableId, status: 'active' },
      relations: ['items'],
    });
    let sumMinor = 0;
    for (const order of activeOrders) {
      for (const item of order.items ?? []) {
        if (OrderStatusPolicy.isItemOnActiveBill(item.status)) {
          sumMinor += Math.max(0, toMinorUnits(item.price)) * Math.max(0, item.quantity);
        }
      }
    }
    return sumMinor;
  }

  private async tableHasBillableItems(
    em: Repository<TableEntity>['manager'],
    restaurantId: string,
    tableId: string,
  ): Promise<boolean> {
    const activeOrders = await em.find(OrderEntity, {
      where: { restaurantId, tableId, status: 'active' },
      relations: ['items'],
    });
    return activeOrders.some((o) =>
      (o.items ?? []).some((i) => OrderStatusPolicy.isItemOnActiveBill(i.status)),
    );
  }

  async findByRestaurant(restaurantId: string): Promise<TableEntity[]> {
    const now = new Date();
    const [tables, activeOrders] = await Promise.all([
      this.repo.find({ where: { restaurantId } }),
      this.repo.manager.find(OrderEntity, {
        where: { restaurantId, status: 'active' },
        relations: ['items'],
      }),
    ]);
    const billableTableIds = new Set<string>();
    for (const ord of activeOrders) {
      if ((ord.items ?? []).some((i) => OrderStatusPolicy.isItemOnActiveBill(i.status))) {
        billableTableIds.add(ord.tableId);
      }
    }
    const staleTableIdsToHeal: string[] = [];
    for (const table of tables) {
      const hasActiveSessionLock = table.hasActiveLock(SESSION_LOCK_STALE_MS, now);
      if (
        (table.status === 'checkout' || table.status === 'occupied') &&
        !hasActiveSessionLock &&
        !billableTableIds.has(table.id)
      ) {
        table.markEmpty();
        staleTableIdsToHeal.push(table.id);
      }
      this.sanitizeStaleLock(table, now);
    }
    if (
      staleTableIdsToHeal.length > 0 &&
      typeof this.repo.manager?.query === 'function'
    ) {
      const staleThresholdIso = new Date(
        now.getTime() - SESSION_LOCK_STALE_MS,
      ).toISOString();
      await this.repo.manager
        .query(
          `UPDATE tables t
           SET status = 'empty',
               discount = NULL,
               split_info = NULL,
               session_staff_id = NULL,
               session_staff_name = NULL,
               session_locked_at = NULL
           WHERE t.restaurant_id = $1::uuid
             AND t.id = ANY($2::uuid[])
             AND t.status IN ('occupied', 'checkout')
             AND (t.session_staff_id IS NULL OR t.session_locked_at IS NULL OR t.session_locked_at < $3::timestamptz)
             AND NOT EXISTS (
               SELECT 1
               FROM orders o
               JOIN order_items oi ON oi.order_id = o.id
               WHERE o.restaurant_id = t.restaurant_id
                 AND o.table_id = t.id
                 AND o.status = 'active'
                 AND oi.status NOT IN ('cancelled', 'ledger', 'paid')
             )`,
          [restaurantId, staleTableIdsToHeal, staleThresholdIso],
        )
        .catch(() => undefined);
    }
    return tables.sort((a, b) => {
      const sectionCmp = a.section.localeCompare(b.section, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (sectionCmp !== 0) return sectionCmp;
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }

  async findOne(id: string, restaurantId: string): Promise<TableEntity> {
    const table = await this.repo.findOne({ where: { id, restaurantId } });
    if (!table) throw new NotFoundException('Table not found');
    return this.sanitizeStaleLock(table);
  }

  async create(restaurantId: string, dto: CreateTableDto): Promise<TableEntity> {
    const name = normalizeStorageText(dto.name ?? '');
    if (!name) {
      throw new BadRequestException('Table name is required');
    }
    const section = normalizeStorageText(dto.section ?? 'default') || 'default';
    const entity = this.repo.create({
      restaurantId,
      name,
      section,
    });
    const saved = await this.repo.save(entity);
    saved.qrToken = TableQrTokenPolicy.generateToken(restaurantId, saved.id);
    return saved;
  }

  async createBulk(
    restaurantId: string,
    dto: BulkCreateTablesDto,
  ): Promise<TableEntity[]> {
    const section = normalizeStorageText(dto.section ?? 'default') || 'default';
    const rawPrefix =
      dto.prefix !== undefined ? String(dto.prefix).replace(/^\s+/, '') : 'Masa ';
    const startNumber = Number.isFinite(Number(dto.startNumber))
      ? Math.max(1, Math.floor(Number(dto.startNumber)))
      : 1;
    const count = Number.isFinite(Number(dto.count))
      ? Math.min(100, Math.max(1, Math.floor(Number(dto.count))))
      : 0;
    if (count < 1 || count > 100) {
      throw new BadRequestException('Bulk table count must be between 1 and 100');
    }

    const entities: TableEntity[] = [];
    for (let i = 0; i < count; i++) {
      const num = startNumber + i;
      const name = normalizeStorageText(`${rawPrefix}${num}`) || `masa ${num}`;
      entities.push(
        this.repo.create({
          restaurantId,
          name,
          section,
        }),
      );
    }
    const saved = await this.repo.save(entities);
    for (const table of saved) {
      table.qrToken = TableQrTokenPolicy.generateToken(restaurantId, table.id);
    }
    return saved;
  }

  async update(
    id: string,
    restaurantId: string,
    dto: UpdateTableDto,
    actor?: SettlementActorPolicy,
  ): Promise<TableEntity> {
    return this.repo.manager.transaction(async (em) => {
      const entity = await em.findOne(TableEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) throw new NotFoundException('Table not found');

      if (dto.name !== undefined) {
        const trimmedName = normalizeStorageText(dto.name);
        if (!trimmedName) throw new BadRequestException('Table name cannot be empty');
        entity.name = trimmedName;
      }
      if (dto.section !== undefined) {
        entity.section = normalizeStorageText(dto.section) || 'default';
      }
      if (dto.discount !== undefined) {
        if (dto.discount !== null && actor && !actor.isBoss) {
          const rawSubtotalMinor = await this.getBillableSubtotalMinorUnits(
            restaurantId,
            entity.id,
            em,
          );
          const discountMinor = computeDiscountMinorUnits(rawSubtotalMinor, dto.discount);
          CheckSettlementPolicy.assertDiscountAllowedForActor(
            rawSubtotalMinor,
            discountMinor,
            dto.discount,
            actor,
          );
        }
        entity.discount = dto.discount;
      }
      if (dto.splitInfo !== undefined) entity.splitInfo = dto.splitInfo;
      if (dto.status !== undefined) {
        const hasBillableItems = await this.tableHasBillableItems(
          em,
          restaurantId,
          entity.id,
        );
        if (dto.status === 'empty') {
          if (hasBillableItems) {
            throw new BadRequestException(
              'Cannot mark table as empty while it has active unpaid orders',
            );
          }
          entity.markEmpty();
        } else if (
          !hasBillableItems &&
          dto.status !== 'reserved' &&
          dto.status !== 'ordering'
        ) {
          entity.markEmpty();
        } else {
          entity.status = dto.status;
        }
      }
      const saved = await em.save(TableEntity, entity);
      saved.qrToken = TableQrTokenPolicy.generateToken(restaurantId, saved.id);
      return saved;
    });
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    await this.repo.manager.transaction(async (em) => {
      const entity = await em.findOne(TableEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) throw new NotFoundException('Table not found');

      const activeOrders = await em.find(OrderEntity, {
        where: { restaurantId, tableId: entity.id, status: 'active' },
        relations: ['items'],
      });
      const hasActiveOrder = activeOrders.some(
        (o) =>
          !Array.isArray(o.items) ||
          o.items.length === 0 ||
          o.items.some((i) => i.status !== 'cancelled'),
      );
      if (hasActiveOrder) {
        throw new BadRequestException(
          'Cannot delete a table that has active open orders',
        );
      }
      await em.remove(TableEntity, entity);
    });
  }

  async buildSessionPresenceMap(
    restaurantId: string,
  ): Promise<Record<string, { staffId: string; staffName: string }>> {
    const now = new Date();
    const rows = await this.repo.find({
      where: { restaurantId },
      select: {
        id: true,
        sessionStaffId: true,
        sessionStaffName: true,
        sessionLockedAt: true,
      },
    });
    const out: Record<string, { staffId: string; staffName: string }> = {};
    for (const table of rows) {
      if (table.sessionStaffId && table.hasActiveLock(SESSION_LOCK_STALE_MS, now)) {
        out[table.id] = {
          staffId: table.sessionStaffId,
          staffName: (table.sessionStaffName ?? 'Waiter').trim() || 'Waiter',
        };
      }
    }
    return out;
  }

  private async assertActiveStaff(restaurantId: string, staffId: string): Promise<void> {
    const staff = await this.staffRepo.findOne({
      where: { id: staffId, restaurantId, isActive: true },
    });
    if (!staff) {
      throw new BadRequestException('No active staff member found for this restaurant');
    }
  }

  assertStaffMayUseTable(
    table: TableEntity,
    staffId: string | null | undefined,
  ): void {
    if (table.status === 'checkout') {
      throw new BadRequestException('Table is currently in checkout');
    }
    if (table.isLockedByOther(staffId, SESSION_LOCK_STALE_MS)) {
      const holder = (table.sessionStaffName ?? 'Waiter').trim() || 'Waiter';
      throw new ForbiddenException(`Table is currently being served by ${holder}`);
    }
  }

  assertTableFreeForMergeOrMove(toTable: TableEntity, actorStaffId?: string | null): void {
    if (toTable.status === 'checkout') {
      throw new BadRequestException('Target table is currently in checkout');
    }
    if (toTable.isLockedByOther(actorStaffId, SESSION_LOCK_STALE_MS)) {
      const holder = (toTable.sessionStaffName ?? 'Waiter').trim() || 'Waiter';
      throw new BadRequestException(
        `Target table is currently being served by ${holder}`,
      );
    }
  }

  async acquireSessionLock(
    restaurantId: string,
    tableId: string,
    staffId: string,
    staffName: string,
  ): Promise<{ ok: true } | { ok: false; holderName: string }> {
    await this.assertActiveStaff(restaurantId, staffId);
    return this.repo.manager.transaction(async (em) => {
      const table = await em.findOne(TableEntity, {
        where: { id: tableId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!table) throw new NotFoundException('Table not found');
      if (table.status === 'checkout') {
        const hasBillable = await this.tableHasBillableItems(em, restaurantId, table.id);
        if (hasBillable) {
          return { ok: false, holderName: 'Register checkout' };
        }
        table.markEmpty();
      }
      const now = new Date();
      if (table.isLockedByOther(staffId, SESSION_LOCK_STALE_MS, now)) {
        const holderName = (table.sessionStaffName ?? 'Waiter').trim() || 'Waiter';
        return { ok: false, holderName };
      }
      table.lockSession(staffId, normalizeStorageText(staffName) || 'waiter', now);
      await em.save(table);
      return { ok: true };
    });
  }

  async releaseSessionLock(
    restaurantId: string,
    tableId: string,
    staffId: string,
    force = false,
  ): Promise<void> {
    await this.repo.manager.transaction(async (em) => {
      const table = await em.findOne(TableEntity, {
        where: { id: tableId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!table) throw new NotFoundException('Table not found');
      const now = new Date();
      if (
        force ||
        table.sessionStaffId === staffId ||
        !table.hasActiveLock(SESSION_LOCK_STALE_MS, now)
      ) {
        table.releaseSession();
        await em.save(TableEntity, table);
      }
    });
  }
}
