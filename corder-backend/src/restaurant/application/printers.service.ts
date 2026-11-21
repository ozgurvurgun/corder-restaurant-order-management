import { forwardRef, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PrinterConfigEntity } from '../domain/printer-config.entity';
import { CreatePrinterDto } from '../api/dto/create-printer.dto';
import { UpdatePrinterDto } from '../api/dto/update-printer.dto';
import { OrdersGateway } from '../api/orders.gateway';
import { normalizeStorageText } from '../../common/text/text-normalizer';

export { CreatePrinterDto, UpdatePrinterDto };

const AGENT_HEARTBEAT_TTL_MS = 30_000;

@Injectable()
export class PrintersService {
  private readonly connectedAgentSockets = new Map<string, Set<string>>();
  private readonly lastHttpHeartbeatMs = new Map<string, number>();

  constructor(
    @InjectRepository(PrinterConfigEntity)
    private readonly repo: Repository<PrinterConfigEntity>,
    @Optional()
    @Inject(forwardRef(() => OrdersGateway))
    private readonly ordersGateway?: OrdersGateway,
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  isAgentOnline(restaurantId: string): boolean {
    const sockets = this.connectedAgentSockets.get(restaurantId);
    if (sockets && sockets.size > 0) {
      return true;
    }
    const lastHeartbeat = this.lastHttpHeartbeatMs.get(restaurantId) ?? 0;
    return lastHeartbeat > 0 && Date.now() - lastHeartbeat <= AGENT_HEARTBEAT_TTL_MS;
  }

  async registerAgentSocket(restaurantId: string, socketId: string): Promise<void> {
    let set = this.connectedAgentSockets.get(restaurantId);
    if (!set) {
      set = new Set<string>();
      this.connectedAgentSockets.set(restaurantId, set);
    }
    set.add(socketId);
    this.lastHttpHeartbeatMs.set(restaurantId, Date.now());
    await this.repo
      .update({ restaurantId }, { status: 'online', updatedAt: new Date() })
      .catch(() => undefined);
  }

  async unregisterAgentSocket(restaurantId: string, socketId: string): Promise<boolean> {
    const set = this.connectedAgentSockets.get(restaurantId);
    if (set) {
      set.delete(socketId);
      if (set.size === 0) {
        this.connectedAgentSockets.delete(restaurantId);
      }
    }
    const remainingSockets = this.connectedAgentSockets.get(restaurantId)?.size ?? 0;
    if (remainingSockets === 0) {
      this.lastHttpHeartbeatMs.delete(restaurantId);
      await this.repo
        .update({ restaurantId }, { status: 'offline', updatedAt: new Date() })
        .catch(() => undefined);
      return true;
    }
    return false;
  }

  async recordAgentHttpHeartbeat(restaurantId: string): Promise<boolean> {
    const wasOnline = this.isAgentOnline(restaurantId);
    this.lastHttpHeartbeatMs.set(restaurantId, Date.now());
    if (!wasOnline) {
      await this.repo
        .update({ restaurantId }, { status: 'online', updatedAt: new Date() })
        .catch(() => undefined);
      return true;
    }
    return false;
  }

  async markAgentLoggedOut(restaurantId: string): Promise<void> {
    this.connectedAgentSockets.delete(restaurantId);
    this.lastHttpHeartbeatMs.delete(restaurantId);
    await this.repo
      .update({ restaurantId }, { status: 'offline', updatedAt: new Date() })
      .catch(() => undefined);
  }

  async list(restaurantId: string): Promise<PrinterConfigEntity[]> {
    const rows = await this.repo.find({
      where: { restaurantId },
      order: { createdAt: 'DESC' },
    });
    const online = this.isAgentOnline(restaurantId);
    const liveStatus = online ? 'online' : 'offline';
    const needsDbSync = rows.some((r) => r.status !== liveStatus);
    if (needsDbSync) {
      void this.repo
        .update({ restaurantId }, { status: liveStatus })
        .catch(() => undefined);
    }
    for (const row of rows) {
      row.status = liveStatus;
    }
    return rows;
  }

  async create(restaurantId: string, dto: CreatePrinterDto) {
    const connection = dto.connection;
    const entity = this.repo.create({
      restaurantId,
      name: normalizeStorageText(dto.name),
      type: dto.type.trim(),
      connection,
      ipAddress:
        connection === 'network'
          ? dto.ipAddress?.trim() || null
          : dto.ipAddress?.trim() || null,
      port: connection === 'network' ? (dto.port ?? 9100) : (dto.port ?? null),
      department: dto.department ? normalizeStorageText(dto.department) || null : null,
      paperWidth: dto.paperWidth ?? 80,
      autoCut: dto.autoCut ?? true,
      status: this.isAgentOnline(restaurantId) ? 'online' : 'offline',
    });
    return this.repo.save(entity);
  }

  async update(restaurantId: string, id: string, dto: UpdatePrinterDto) {
    const existing = await this.repo.findOne({ where: { id, restaurantId } });
    if (!existing) {
      throw new NotFoundException('Printer not found');
    }
    const nextConnection = dto.connection ?? existing.connection;
    Object.assign(existing, {
      name: dto.name !== undefined ? normalizeStorageText(dto.name) : existing.name,
      type: dto.type !== undefined ? dto.type.trim() : existing.type,
      connection: nextConnection,
      ipAddress:
        dto.ipAddress !== undefined
          ? dto.ipAddress?.trim() || null
          : nextConnection !== 'network' && dto.connection !== undefined
            ? null
            : existing.ipAddress,
      port:
        dto.port !== undefined
          ? dto.port
          : nextConnection !== 'network' && dto.connection !== undefined
            ? null
            : existing.port,
      department:
        dto.department !== undefined
          ? dto.department
            ? normalizeStorageText(dto.department) || null
            : null
          : existing.department,
      status: dto.status ?? existing.status,
      paperWidth: dto.paperWidth ?? existing.paperWidth,
      autoCut: dto.autoCut ?? existing.autoCut,
    });
    existing.updatedAt = new Date();
    return this.repo.save(existing);
  }

  async remove(restaurantId: string, id: string) {
    const res = await this.repo.delete({ id, restaurantId });
    if (!res.affected) {
      throw new NotFoundException('Printer not found');
    }
    return { ok: true };
  }

  async syncFromPrintAgent(
    restaurantId: string,
    body: {
      printers?: Array<{
        id?: string;
        name?: string;
        mode?: string;
        host?: string;
        port?: number;
        systemPrinterName?: string;
        paperWidth?: number;
        role?: string;
        department?: string | null;
        autoCut?: boolean;
      }>;
      receiptPrinterId?: string;
      defaultKitchenPrinterId?: string;
    },
  ): Promise<PrinterConfigEntity[]> {
    this.lastHttpHeartbeatMs.set(restaurantId, Date.now());
    const incoming = Array.isArray(body?.printers) ? body.printers : [];
    const receiptId = (body?.receiptPrinterId ?? '').trim();
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const runTransaction =
      this.dataSource && typeof this.dataSource.transaction === 'function'
        ? this.dataSource.transaction.bind(this.dataSource)
        : this.repo.manager.transaction.bind(this.repo.manager);
    const { savedList, changed } = await runTransaction(async (em) => {
      const existing = await em.find(PrinterConfigEntity, {
        where: { restaurantId },
        order: { createdAt: 'ASC' },
      });
      const claimedIds = new Set<string>();
      const savedRows: PrinterConfigEntity[] = [];
      let rowsChanged = false;

      for (const p of incoming) {
        const name = normalizeStorageText(
          String(p.name || p.systemPrinterName || p.host || 'yazıcı'),
        ).slice(0, 100);
        if (!name) continue;
        const isReceipt =
          Boolean(p.id && receiptId && p.id === receiptId) ||
          p.role === 'receipt' ||
          /kasa|adisyon|fiş|fis|receipt/i.test(name);
        const nextType = isReceipt ? 'receipt' : 'kitchen';
        const isNetwork = p.mode === 'network';
        const connection = isNetwork ? 'network' : 'usb';
        const ipAddress = isNetwork
          ? (p.host?.trim() || '127.0.0.1').slice(0, 100)
          : (p.systemPrinterName?.trim() || 'USB').slice(0, 100);
        const port = isNetwork ? Number(p.port) || 9100 : null;
        const paperWidth = Number(p.paperWidth) === 58 ? 58 : 80;
        const department = normalizeStorageText(
          p.department?.trim() || (isReceipt ? 'kasa' : 'mutfak'),
        ).slice(0, 100);
        const autoCut = p.autoCut !== false;

        let match =
          p.id && uuidRe.test(p.id)
            ? existing.find((e) => e.id === p.id && !claimedIds.has(e.id))
            : undefined;
        if (!match) {
          match = existing.find(
            (e) =>
              !claimedIds.has(e.id) &&
              e.name.trim().toLowerCase() === name.toLowerCase(),
          );
        }

        if (match) {
          claimedIds.add(match.id);
          const hasDiff =
            match.name !== name ||
            match.type !== nextType ||
            match.connection !== connection ||
            (match.ipAddress ?? null) !== (ipAddress ?? null) ||
            (match.port ?? null) !== (port ?? null) ||
            (match.department ?? null) !== (department ?? null) ||
            match.paperWidth !== paperWidth ||
            match.autoCut !== autoCut ||
            match.status !== 'online';
          if (hasDiff) {
            rowsChanged = true;
            Object.assign(match, {
              name,
              type: nextType,
              connection,
              ipAddress,
              port,
              department,
              paperWidth,
              autoCut,
              status: 'online',
              updatedAt: new Date(),
            });
            savedRows.push(await em.save(PrinterConfigEntity, match));
          } else {
            savedRows.push(match);
          }
        } else {
          rowsChanged = true;
          const created = em.create(PrinterConfigEntity, {
            restaurantId,
            name,
            type: nextType,
            connection,
            ipAddress,
            port,
            department,
            paperWidth,
            autoCut,
            status: 'online',
          });
          const saved = await em.save(PrinterConfigEntity, created);
          claimedIds.add(saved.id);
          savedRows.push(saved);
        }
      }

      for (const oldRow of existing) {
        if (!claimedIds.has(oldRow.id)) {
          rowsChanged = true;
          await em.remove(PrinterConfigEntity, oldRow);
        }
      }

      return { savedList: savedRows, changed: rowsChanged };
    });

    if (changed) {
      this.ordersGateway?.emitPrintersUpdated(restaurantId);
    }
    return savedList;
  }

  async syncFromAgent(
    restaurantId: string,
    body: Parameters<PrintersService['syncFromPrintAgent']>[1],
  ): Promise<PrinterConfigEntity[]> {
    return this.syncFromPrintAgent(restaurantId, body);
  }
}
