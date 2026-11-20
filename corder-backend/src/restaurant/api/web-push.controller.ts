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
import { WebPushAppType } from '../domain/web-push-subscription.entity';
import { WebPushService } from '../application/web-push.service';
import {
  SubscribeWebPushDto,
  UnsubscribeWebPushDto,
} from './dto/web-push.dto';

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
    @RestaurantUser() user: { id?: string; role?: string } | undefined,
    @Body() dto: SubscribeWebPushDto,
  ) {
    if (!user || user.role === 'print_agent') {
      throw new ForbiddenException('Unauthorized push subscription');
    }
    const appType = this.resolveAppType(dto?.appType, user.role);
    const rootAdminId =
      user.role === 'root' && typeof user.id === 'string' && user.id.trim()
        ? user.id.trim()
        : null;
    const ok = await this.webPushService.saveSubscription(
      restaurantId,
      appType,
      dto.subscription,
      rootAdminId,
    );
    return { ok };
  }

  @Post('unsubscribe')
  async unsubscribe(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { role?: string } | undefined,
    @Body() dto: UnsubscribeWebPushDto,
  ) {
    if (!user || user.role === 'print_agent') {
      throw new ForbiddenException('Unauthorized push access');
    }
    await this.webPushService.removeSubscription(
      restaurantId,
      dto?.endpoint ?? '',
    );
    return { ok: true };
  }
}
