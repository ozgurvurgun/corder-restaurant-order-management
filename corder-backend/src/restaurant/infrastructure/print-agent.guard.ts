import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import {
  buildPaymentSuspendedErrorMessage,
  computeSecretFingerprint,
  isRestaurantPaymentSuspended,
  RestaurantAuthService,
  RestaurantTokenPayload,
} from '../application/restaurant-auth.service';
import { requireConfigSecret } from '../../common/security/env.validation';

export type PrintAgentRequest = {
  printAgentRestaurantId: string;
  headers: { authorization?: string };
};

@Injectable()
export class PrintAgentGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly authService: RestaurantAuthService,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PrintAgentRequest>();
    const raw = request.headers?.authorization;
    const token = raw?.startsWith('Bearer ') ? raw.slice(7).trim() : raw?.trim();
    if (!token) {
      throw new UnauthorizedException('Print Agent authentication required');
    }
    let payload: RestaurantTokenPayload;
    try {
      const secret = requireConfigSecret(this.config, 'JWT_SECRET');
      payload = this.jwt.verify<RestaurantTokenPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid or expired Print Agent session');
    }
    if (
      payload.type !== 'restaurant' ||
      payload.role !== 'print_agent' ||
      !payload.restaurantId ||
      !payload.email
    ) {
      throw new UnauthorizedException('Invalid Print Agent token role');
    }
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: payload.restaurantId },
      select: {
        id: true,
        name: true,
        status: true,
        printAgentUsername: true,
        printAgentPasswordHash: true,
        isAccessSuspended: true,
        billingStatus: true,
      },
    });
    if (isRestaurantPaymentSuspended(restaurant)) {
      throw new UnauthorizedException(
        buildPaymentSuspendedErrorMessage(restaurant?.name),
      );
    }
    if (
      !restaurant ||
      restaurant.status !== 'active' ||
      !restaurant.printAgentUsername ||
      !restaurant.printAgentPasswordHash ||
      restaurant.printAgentUsername !== payload.email
    ) {
      throw new UnauthorizedException('Print Agent account is inactive or changed');
    }
    const expectedFp = computeSecretFingerprint(restaurant.printAgentPasswordHash);
    if (payload.pwdFp && payload.pwdFp !== expectedFp) {
      throw new UnauthorizedException('Print Agent password has been changed');
    }
    request.printAgentRestaurantId = restaurant.id;
    return true;
  }
}
