import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  computeSecretFingerprint,
  isRestaurantPaymentSuspended,
  RestaurantAuthService,
  RestaurantTokenPayload,
} from '../application/restaurant-auth.service';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { RestaurantStaffEntity } from '../domain/restaurant-staff.entity';
import { RolesService } from '../application/roles.service';
import { TableService } from '../application/table.service';
import { buildCorsOptions } from '../../common/security/cors.config';
import { requireConfigSecret } from '../../common/security/env.validation';

function getRestaurantRoom(restaurantId: string) {
  return `restaurant:${restaurantId}`;
}

function getPrintAgentRoom(restaurantId: string) {
  return `restaurant:${restaurantId}:print-agent`;
}

const MAX_TIMEOUT_MS = 2_147_483_647;

export interface PrintJobSocketPayload {
  type: 'order.print_job';
  jobId: string;
  restaurantId: string;
  printType: 'receipt' | 'kitchen_cancel';
  createdAt: string;
  receiptMode?: 'consolidated' | 'split';
  /** false on consolidated register summary (line merge, no notes); true on single check / split. */
  includeLineNotes?: boolean;
  isReprint?: boolean;
  openCashDrawer?: boolean;
  order: {
    tableId?: string;
    orderId?: string;
    completedOrderId?: string;
    tableName: string;
    waiterName: string;
    paymentMethod?: string;
    subtotal?: number;
    discountAmount?: number;
    discountLabel?: string;
    tipAmount?: number;
    /** Printed on `kitchen_cancel` tickets. */
    cancelledBy?: string;
    cancelReason?: string;
    items: {
      productName: string;
      quantity: number;
      price: number;
      note?: string;
      productId?: string;
      categoryId?: string;
    }[];
    total: number;
  };
}

interface VerifiedSocketAuth {
  restaurantId: string;
  role: RestaurantTokenPayload['role'];
  authType: 'print-agent-jwt' | 'jwt';
  expMs: number | null;
}

@WebSocketGateway({
  cors: buildCorsOptions(),
  path: '/ws',
})
@Injectable()
export class OrdersGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authService: RestaurantAuthService,
    private readonly rolesService: RolesService,
    private readonly tableService: TableService,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
  ) {}

  afterInit(server: Server): void {
    server.use(async (client: Socket, next) => {
      try {
        const verified = await this.verifyClientHandshake(client);
        if (!verified) {
          next(new Error('Unauthorized'));
          return;
        }
        client.data.verifiedAuth = verified;
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  private async verifyClientHandshake(client: Socket): Promise<VerifiedSocketAuth | null> {
    const rawHeader = client.handshake.headers?.authorization;
    const headerToken =
      typeof rawHeader === 'string' ? rawHeader.replace(/^Bearer\s+/i, '').trim() : '';
    const authToken =
      typeof client.handshake.auth?.token === 'string' ? client.handshake.auth.token.trim() : '';
    const token = authToken || headerToken;
    if (!token) return null;

    const secret = requireConfigSecret(this.config, 'JWT_SECRET');
    const payload = this.jwt.verify<RestaurantTokenPayload & { exp?: number }>(token, { secret });
    if (
      payload.type !== 'restaurant' ||
      !payload.restaurantId ||
      (payload.role !== 'root' &&
        payload.role !== 'staff' &&
        payload.role !== 'terminal' &&
        payload.role !== 'print_agent')
    ) {
      return null;
    }

    const expMs = typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    if (expMs !== null && expMs <= Date.now()) {
      return null;
    }

    const requestedRestId =
      payload.role === 'root' && typeof client.handshake.auth?.restaurantId === 'string'
        ? client.handshake.auth.restaurantId.trim()
        : '';
    const targetRestId = requestedRestId || payload.restaurantId;

    if (payload.role === 'root') {
      await this.authService.assertBossOwnsRestaurant(payload.sub, targetRestId);
    }

    const activeRestaurant = await this.restaurantRepo.findOne({
      where: { id: targetRestId },
      select: {
        id: true,
        status: true,
        terminalEmail: true,
        terminalPasswordHash: true,
        printAgentUsername: true,
        printAgentPasswordHash: true,
        isAccessSuspended: true,
        billingStatus: true,
      },
    });
    if (!activeRestaurant || activeRestaurant.status !== 'active') {
      return null;
    }
    if (
      isRestaurantPaymentSuspended(activeRestaurant) &&
      !(await this.authService.hasOpenCashShift(targetRestId))
    ) {
      return null;
    }

    if (payload.role === 'print_agent') {
      if (
        !activeRestaurant.printAgentUsername ||
        !activeRestaurant.printAgentPasswordHash ||
        activeRestaurant.printAgentUsername !== payload.email
      ) {
        return null;
      }
      const expectedFp = computeSecretFingerprint(activeRestaurant.printAgentPasswordHash);
      if (payload.pwdFp && payload.pwdFp !== expectedFp) {
        return null;
      }
    } else if (payload.role === 'terminal') {
      if (
        !activeRestaurant.terminalEmail ||
        !activeRestaurant.terminalPasswordHash ||
        activeRestaurant.terminalEmail.toLowerCase().trim() !==
          (payload.email || '').toLowerCase().trim()
      ) {
        return null;
      }
      if (
        payload.pwdFp &&
        payload.pwdFp !== computeSecretFingerprint(activeRestaurant.terminalPasswordHash)
      ) {
        return null;
      }
    } else if (payload.role === 'staff') {
      const staff = await this.staffRepo.findOne({
        where: { id: payload.sub, restaurantId: targetRestId, isActive: true },
      });
      if (!staff || !staff.passwordHash) {
        return null;
      }
      if (payload.pwdFp && payload.pwdFp !== computeSecretFingerprint(staff.passwordHash)) {
        return null;
      }
      const resolved = await this.rolesService.resolveForStaff(staff);
      if (!resolved.canAccessPanel && !resolved.canAccessTerminal) {
        return null;
      }
    }

    return {
      restaurantId: targetRestId,
      role: payload.role,
      authType: payload.role === 'print_agent' ? 'print-agent-jwt' : 'jwt',
      expMs,
    };
  }

  private scheduleSocketExpiry(client: Socket, expMs: number): void {
    this.clearSocketExpiry(client.id);
    const remainingMs = expMs - Date.now();
    if (remainingMs <= 0) {
      client.emit('auth:expired', { reason: 'Token expired' });
      client.disconnect(true);
      return;
    }
    const delay = Math.min(remainingMs, MAX_TIMEOUT_MS);
    const timer = setTimeout(() => {
      if (expMs - Date.now() > 1000) {
        this.scheduleSocketExpiry(client, expMs);
        return;
      }
      this.expiryTimers.delete(client.id);
      client.emit('auth:expired', { reason: 'Token expired' });
      client.disconnect(true);
    }, delay);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    this.expiryTimers.set(client.id, timer);
  }

  private clearSocketExpiry(clientId: string): void {
    const existing = this.expiryTimers.get(clientId);
    if (existing) {
      clearTimeout(existing);
      this.expiryTimers.delete(clientId);
    }
  }

  async handleConnection(client: Socket) {
    try {
      const verified: VerifiedSocketAuth | null =
        (client.data.verifiedAuth as VerifiedSocketAuth | undefined) ??
        (await this.verifyClientHandshake(client));
      if (!verified) {
        client.disconnect(true);
        return;
      }

      client.data.restaurantId = verified.restaurantId;
      client.data.role = verified.role;
      client.data.authType = verified.authType;
      client.join(getRestaurantRoom(verified.restaurantId));
      if (verified.role === 'print_agent') {
        client.join(getPrintAgentRoom(verified.restaurantId));
      }
      if (verified.expMs !== null) {
        this.scheduleSocketExpiry(client, verified.expMs);
      }
      if (verified.role !== 'print_agent') {
        const map = await this.tableService.buildSessionPresenceMap(verified.restaurantId);
        client.emit('tables:presence', map);
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.clearSocketExpiry(client.id);
  }

  async emitTableSessionPresence(restaurantId: string): Promise<void> {
    const payload = await this.tableService.buildSessionPresenceMap(restaurantId);
    this.server.to(getRestaurantRoom(restaurantId)).emit('tables:presence', payload);
  }

  emitOrderCreated(restaurantId: string, order: Record<string, unknown>) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('order:created', order);
  }

  emitOrdersMoved(
    restaurantId: string,
    payload: { fromTableId: string; toTableId: string },
  ) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('orders:moved', payload);
  }

  /** General order update (close check, move, cancel, etc.) – all clients refetch */
  emitOrdersUpdated(restaurantId: string) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('orders:updated');
  }

  /** Notify panel and print-agent when printer configurations change */
  emitPrintersUpdated(restaurantId: string) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('printers:updated');
  }

  /** Receipt / check / cancel print – print-agent listens on `order.print_job` */
  emitPrintJob(restaurantId: string, payload: PrintJobSocketPayload) {
    this.server.to(getPrintAgentRoom(restaurantId)).emit('order.print_job', payload);
  }
}

