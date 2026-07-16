import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableEntity } from '../domain/table.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { CreateTableDto } from '../api/dto/create-table.dto';
import { UpdateTableDto } from '../api/dto/update-table.dto';

/** Grace period (ms) to automatically take over a stale lock after disconnect. */
const SESSION_LOCK_STALE_MS = 120_000;

@Injectable()
export class TableService {
  constructor(
    @InjectRepository(TableEntity)
    private readonly repo: Repository<TableEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
  ) {}

  async findByRestaurant(restaurantId: string): Promise<TableEntity[]> {
    const tables = await this.repo.find({ where: { restaurantId } });
    return tables.sort((a, b) => {
      const sectionCmp = a.section.localeCompare(b.section, 'tr', { numeric: true, sensitivity: 'base' });
      if (sectionCmp !== 0) return sectionCmp;
      return a.name.localeCompare(b.name, 'tr', { numeric: true, sensitivity: 'base' });
    });
  }

  async findOne(id: string, restaurantId: string): Promise<TableEntity> {
    const t = await this.repo.findOne({ where: { id, restaurantId } });
    if (!t) throw new NotFoundException('Table not found');
    return t;
  }

  async create(restaurantId: string, dto: CreateTableDto): Promise<TableEntity> {
    const entity = this.repo.create({
      restaurantId,
      name: dto.name,
      section: dto.section ?? 'default',
    });
    return this.repo.save(entity);
  }

  async update(id: string, restaurantId: string, dto: UpdateTableDto): Promise<TableEntity> {
    const entity = await this.findOne(id, restaurantId);
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.section !== undefined) entity.section = dto.section;
    if (dto.status !== undefined) {
      entity.status = dto.status;
      // Session lock is only cleared when the table is actually vacated. Cash register 'checkout' / 'occupied'
      // transitions do not drop the waiter from the table; other waiters still see the lock until the check modal closes.
      if (dto.status === 'empty') {
        entity.sessionStaffId = null;
        entity.sessionStaffName = null;
        entity.sessionLockedAt = null;
      }
    }
    return this.repo.save(entity);
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const entity = await this.findOne(id, restaurantId);
    await this.repo.remove(entity);
  }

  async buildSessionPresenceMap(restaurantId: string): Promise<Record<string, { staffId: string; staffName: string }>> {
    const rows = await this.repo.find({
      where: { restaurantId },
      select: { id: true, sessionStaffId: true, sessionStaffName: true },
    });
    const out: Record<string, { staffId: string; staffName: string }> = {};
    for (const t of rows) {
      if (t.sessionStaffId) {
        out[t.id] = {
          staffId: t.sessionStaffId,
          staffName: (t.sessionStaffName ?? 'Garson').trim() || 'Garson',
        };
      }
    }
    return out;
  }

  private async assertActiveStaff(restaurantId: string, staffId: string): Promise<void> {
    const s = await this.staffRepo.findOne({ where: { id: staffId, restaurantId, isActive: true } });
    if (!s) throw new BadRequestException('Bu restoran icin gecerli garson bulunamadi');
  }

  /** Order / action: block if another waiter holds the lock (or cash register checkout). */
  assertStaffMayUseTable(table: TableEntity, staffId: string | null | undefined): void {
    if (table.status === 'checkout') {
      throw new BadRequestException('Masa hesap kesiminde');
    }
    if (!table.sessionStaffId) return;
    const now = new Date();
    const staleBefore = new Date(now.getTime() - SESSION_LOCK_STALE_MS);
    if (!table.sessionLockedAt || table.sessionLockedAt < staleBefore) return;
    const sid = (staffId ?? '').trim();
    if (!sid || table.sessionStaffId !== sid) {
      const h = (table.sessionStaffName ?? 'Garson').trim() || 'Garson';
      throw new ForbiddenException(`Bu masada su an ${h} calisiyor`);
    }
  }

  /** Table merge: block if the target is open on another waiter (except stale locks). */
  assertTableFreeForMergeOrMove(toTable: TableEntity): void {
    if (toTable.status === 'checkout') {
      throw new BadRequestException('Hedef masa hesap kesiminde');
    }
    if (!toTable.sessionStaffId) return;
    const now = new Date();
    const staleBefore = new Date(now.getTime() - SESSION_LOCK_STALE_MS);
    if (!toTable.sessionLockedAt || toTable.sessionLockedAt < staleBefore) return;
    const h = (toTable.sessionStaffName ?? 'Garson').trim() || 'Garson';
    throw new BadRequestException(`Hedef masada su an ${h} calisiyor`);
  }

  /**
   * Waiter on table — DB lock (like cash register checkout). Another waiter cannot take it; reclaimable after timeout.
   */
  async acquireSessionLock(
    restaurantId: string,
    tableId: string,
    staffId: string,
    staffName: string,
  ): Promise<{ ok: true } | { ok: false; holderName: string }> {
    await this.assertActiveStaff(restaurantId, staffId);
    return this.repo.manager.transaction(async (em) => {
      const t = await em.findOne(TableEntity, {
        where: { id: tableId, restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!t) throw new NotFoundException('Table not found');
      if (t.status === 'checkout') {
        return { ok: false, holderName: 'Kasa hesap kesiminde' };
      }
      const now = new Date();
      const staleBefore = new Date(now.getTime() - SESSION_LOCK_STALE_MS);
      const holderId = t.sessionStaffId;
      const holderName = (t.sessionStaffName ?? 'Garson').trim() || 'Garson';
      const lockedAt = t.sessionLockedAt;
      if (holderId && holderId !== staffId) {
        if (lockedAt && lockedAt >= staleBefore) {
          return { ok: false, holderName };
        }
      }
      t.sessionStaffId = staffId;
      t.sessionStaffName = staffName.trim() || 'Garson';
      t.sessionLockedAt = now;
      await em.save(t);
      return { ok: true };
    });
  }

  async releaseSessionLock(restaurantId: string, tableId: string, staffId: string): Promise<void> {
    const t = await this.findOne(tableId, restaurantId);
    if (t.sessionStaffId === staffId) {
      t.sessionStaffId = null;
      t.sessionStaffName = null;
      t.sessionLockedAt = null;
      await this.repo.save(t);
    }
  }

}
