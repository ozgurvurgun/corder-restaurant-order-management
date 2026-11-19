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
import {
  buildPaymentSuspendedErrorMessage,
  RestaurantTokenPayload,
} from '../domain/services/billing-suspension.policy';
import {
  RestaurantSessionValidatorService,
  VerifiedSocketPrincipal,
} from '../application/restaurant-session-validator.service';
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
  includeLineNotes?: boolean;
  isReprint?: boolean;
  openCashDrawer?: boolean;
  shiftReport?: Record<string, unknown> | null;
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
    private readonly sessionValidator: RestaurantSessionValidatorService,
    private readonly tableService: TableService,
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

  private async verifyClientHandshake(
    client: Socket,
  ): Promise<VerifiedSocketPrincipal | null> {
    const rawHeader = client.handshake.headers?.authorization;
    const headerToken =
      typeof rawHeader === 'string' ? rawHeader.replace(/^Bearer\s+/i, '').trim() : '';
    const authToken =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token.trim()
        : '';
    const token = authToken || headerToken;
    if (!token) return null;

    const secret = requireConfigSecret(this.config, 'JWT_SECRET');
    const payload = this.jwt.verify<RestaurantTokenPayload & { exp?: number }>(token, {
      secret,
    });
    const requestedRestId =
      typeof client.handshake.auth?.restaurantId === 'string'
        ? client.handshake.auth.restaurantId
        : undefined;

    return this.sessionValidator.validateSocketTokenPayload(payload, requestedRestId);
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
      const verified: VerifiedSocketPrincipal | null =
        (client.data.verifiedAuth as VerifiedSocketPrincipal | undefined) ??
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

  emitOrdersUpdated(restaurantId: string) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('orders:updated');
  }

  emitPrintersUpdated(restaurantId: string) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('printers:updated');
  }

  emitWaiterCalled(restaurantId: string, payload: Record<string, unknown>) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('waiter:called', payload);
  }

  emitNotificationsUpdated(restaurantId: string) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('notifications:updated');
  }

  emitFraudAlert(restaurantId: string, payload: Record<string, unknown>) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('fraud:alert', payload);
  }

  emitPrintJob(restaurantId: string, payload: PrintJobSocketPayload) {
    this.server.to(getPrintAgentRoom(restaurantId)).emit('order.print_job', payload);
  }

  emitAuthExpired(restaurantId: string, reason?: string) {
    if (!this.server) return;
    const room = getRestaurantRoom(restaurantId);
    this.server.to(room).emit('auth:expired', {
      reason: reason || buildPaymentSuspendedErrorMessage(),
    });
    this.server.in(room).disconnectSockets(true);
  }

  emitPlatformNotification(
    restaurantIds: string[],
    payload: {
      id: string;
      title: string;
      message: string;
      level: string;
      targetApps: string[];
      targetRestaurantIds: string[];
      sentAt: string;
      createdAt: string;
    },
  ) {
    if (!this.server) return;
    for (const restaurantId of restaurantIds) {
      this.server
        .to(getRestaurantRoom(restaurantId))
        .emit('platform:notification', payload);
    }
  }
}
