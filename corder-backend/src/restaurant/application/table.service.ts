import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TableEntity } from '../domain/table.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { CreateTableDto } from '../api/dto/create-table.dto';
import { UpdateTableDto } from '../api/dto/update-table.dto';

/** Grace period (ms) to automatically take over a stale lock after disconnect. */
const SESSION_LOCK_STALE_MS = 120_000;

@Injectable()
export class TableService implements OnModuleInit {
  constructor(
    @InjectRepository(TableEntity)
    private readonly repo: Repository<TableEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.repo
      .query(
        `ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "discount" jsonb, ADD COLUMN IF NOT EXISTS "split_info" jsonb`,
      )
      .catch(() => undefined);
  }

  async findByRestaurant(restaurantId: string): Promise<TableEntity[]> {
    const tables = await this.repo.find({ where: { restaurantId } });
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
    return table;
  }

  async create(restaurantId: string, dto: CreateTableDto): Promise<TableEntity> {
    const entity = this.repo.create({
      restaurantId,
      name: dto.name,
      section: dto.section ?? 'default',
    });
    return this.repo.save(entity);
  }

  async update(
    id: string,
    restaurantId: string,
    dto: UpdateTableDto,
  ): Promise<TableEntity> {
    const entity = await this.findOne(id, restaurantId);
    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.section !== undefined) entity.section = dto.section;
    if (dto.discount !== undefined) entity.discount = dto.discount;
    if (dto.splitInfo !== undefined) entity.splitInfo = dto.splitInfo;
    if (dto.status !== undefined) {
      if (dto.status === 'empty') {
        entity.markEmpty();
      } else {
        entity.status = dto.status;
      }
    }
    return this.repo.save(entity);
  }

  async remove(id: string, restaurantId: string): Promise<void> {
    const entity = await this.findOne(id, restaurantId);
    await this.repo.remove(entity);
  }

  async buildSessionPresenceMap(
    restaurantId: string,
  ): Promise<Record<string, { staffId: string; staffName: string }>> {
    const rows = await this.repo.find({
      where: { restaurantId },
      select: { id: true, sessionStaffId: true, sessionStaffName: true },
    });
    const out: Record<string, { staffId: string; staffName: string }> = {};
    for (const table of rows) {
      if (table.sessionStaffId) {
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

  assertTableFreeForMergeOrMove(toTable: TableEntity): void {
    if (toTable.status === 'checkout') {
      throw new BadRequestException('Target table is currently in checkout');
    }
    if (toTable.hasActiveLock(SESSION_LOCK_STALE_MS)) {
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
        return { ok: false, holderName: 'Register checkout' };
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
    const table = await this.findOne(tableId, restaurantId);
    if (force || table.sessionStaffId === staffId) {
      table.releaseSession();
      await this.repo.save(table);
    }
  }
}
