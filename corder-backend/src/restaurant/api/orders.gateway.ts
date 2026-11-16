import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RestaurantAuthService,
  RestaurantTokenPayload,
} from '../application/restaurant-auth.service';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { TableService } from '../application/table.service';
import { buildCorsOptions } from '../../common/security/cors.config';

function getRestaurantRoom(restaurantId: string) {
  return `restaurant:${restaurantId}`;
}

@WebSocketGateway({
  cors: buildCorsOptions(),
  path: '/ws',
})
@Injectable()
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authService: RestaurantAuthService,
    private readonly tableService: TableService,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token || client.handshake.headers?.authorization?.replace?.('Bearer ', '');
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const secret = this.config.get<string>('JWT_SECRET');
      const payload = this.jwt.verify<RestaurantTokenPayload>(token, { secret });
      if (
        payload.type !== 'restaurant' ||
        !payload.restaurantId ||
        (payload.role !== 'root' &&
          payload.role !== 'staff' &&
          payload.role !== 'terminal' &&
          payload.role !== 'print_agent')
      ) {
        client.disconnect(true);
        return;
      }
      const requestedRestId =
        payload.role === 'root' && typeof client.handshake.auth?.restaurantId === 'string'
          ? client.handshake.auth.restaurantId.trim()
          : '';
      const targetRestId = requestedRestId || payload.restaurantId;
      if (payload.role === 'root') {
        try {
          await this.authService.assertBossOwnsRestaurant(payload.sub, targetRestId);
        } catch {
          client.disconnect(true);
          return;
        }
      }
      const activeRestaurant = await this.restaurantRepo.findOne({
        where: { id: targetRestId },
        select: { id: true, status: true, printAgentUsername: true },
      });
      if (!activeRestaurant || activeRestaurant.status !== 'active') {
        client.disconnect(true);
        return;
      }
      if (
        payload.role === 'print_agent' &&
        (!activeRestaurant.printAgentUsername || activeRestaurant.printAgentUsername !== payload.email)
      ) {
        client.disconnect(true);
        return;
      }
      client.data.restaurantId = targetRestId;
      client.data.authType = payload.role === 'print_agent' ? 'print-agent-jwt' : 'jwt';
      client.join(getRestaurantRoom(targetRestId));
      if (payload.role !== 'print_agent') {
        const map = await this.tableService.buildSessionPresenceMap(targetRestId);
        client.emit('tables:presence', map);
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket): void {
    /* Waiter lock lives in the DB now; it does not clear automatically on socket disconnect (like register checkout). */
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

  /** Receipt / check print – print-agent listens on `order.print_job` */
  emitPrintJob(
    restaurantId: string,
    payload: {
      type: 'order.print_job';
      jobId: string;
      restaurantId: string;
      printType: 'receipt' | 'kitchen_cancel';
      createdAt: string;
      receiptMode?: 'consolidated' | 'split';
      /** false on consolidated register summary (line merge, no notes); true on single check / split. */
      includeLineNotes?: boolean;
      order: {
        tableName: string;
        waiterName: string;
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
    },
  ) {
    this.server.to(getRestaurantRoom(restaurantId)).emit('order.print_job', payload);
  }
}
