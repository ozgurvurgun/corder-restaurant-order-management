import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import {
  WebPushAppType,
  WebPushService,
  WebPushSubscriptionInput,
} from '../application/web-push.service';

@Controller('restaurant/push')
@UseGuards(RestaurantJwtGuard)
export class WebPushController {
  constructor(private readonly webPushService: WebPushService) {}

  private resolveAppType(
    requestedAppType: unknown,
    role?: string,
  ): WebPushAppType {
    if (role === 'terminal' || requestedAppType === 'terminal') {
      return 'terminal';
    }
    if (requestedAppType === 'boss') {
      return 'boss';
    }
    return 'merchant';
  }

  @Get('vapid-public-key')
  async getVapidPublicKey(@RestaurantUser() user?: { role?: string }) {
    if (!user || user.role === 'print_agent') {
      throw new ForbiddenException('Unauthorized push access');
    }
    const publicKey = await this.webPushService.getVapidPublicKey();
    return { publicKey };
  }

  @Post('subscribe')
  async subscribe(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { role?: string } | undefined,
    @Body()
    body: {
      appType?: string;
      subscription?: WebPushSubscriptionInput;
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    },
  ) {
    if (!user || user.role === 'print_agent') {
      throw new ForbiddenException('Unauthorized push subscription');
    }
    const appType = this.resolveAppType(body?.appType, user.role);
    const sub: WebPushSubscriptionInput = body?.subscription ?? {
      endpoint: body?.endpoint,
      keys: body?.keys,
    };
    const ok = await this.webPushService.saveSubscription(
      restaurantId,
      appType,
      sub,
    );
    return { ok };
  }

  @Post('unsubscribe')
  async unsubscribe(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { role?: string } | undefined,
    @Body() body: { endpoint?: string },
  ) {
    if (!user || user.role === 'print_agent') {
      throw new ForbiddenException('Unauthorized push access');
    }
    await this.webPushService.removeSubscription(
      restaurantId,
      body?.endpoint ?? '',
    );
    return { ok: true };
  }
}
