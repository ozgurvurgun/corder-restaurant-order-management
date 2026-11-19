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
import { TableQrTokenPolicy } from '../domain/services/table-qr-token.policy';
import { BulkCreateTablesDto, CreateTableDto } from '../api/dto/create-table.dto';
import { UpdateTableDto } from '../api/dto/update-table.dto';

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
    const staleTablesToHeal: TableEntity[] = [];
    for (const table of tables) {
      if (
        (table.status === 'checkout' ||
          table.status === 'occupied' ||
          table.status === 'ordering') &&
        !billableTableIds.has(table.id)
      ) {
        table.markEmpty();
        staleTablesToHeal.push(table);
      }
      this.sanitizeStaleLock(table, now);
    }
    if (staleTablesToHeal.length > 0) {
      await this.repo.save(staleTablesToHeal).catch(() => undefined);
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
    const name = (dto.name ?? '').trim();
    if (!name) {
      throw new BadRequestException('Table name is required');
    }
    const section = (dto.section ?? 'default').trim() || 'default';
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
    const section = (dto.section ?? 'default').trim() || 'default';
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
      const name = `${rawPrefix}${num}`.trim() || `Masa ${num}`;
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
  ): Promise<TableEntity> {
    return this.repo.manager.transaction(async (em) => {
      const entity = await em.findOne(TableEntity, {
        where: { id, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) throw new NotFoundException('Table not found');

      if (dto.name !== undefined) {
        const trimmedName = dto.name.trim();
        if (!trimmedName) throw new BadRequestException('Table name cannot be empty');
        entity.name = trimmedName;
      }
      if (dto.section !== undefined) {
        entity.section = dto.section.trim() || 'default';
      }
      if (dto.discount !== undefined) entity.discount = dto.discount;
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
        } else if (!hasBillableItems && dto.status !== 'reserved') {
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
      const hasBillableItems = activeOrders.some((o) =>
        (o.items ?? []).some((i) => OrderStatusPolicy.isItemOnActiveBill(i.status)),
      );
      if (hasBillableItems) {
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
      table.lockSession(staffId, staffName, now);
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
