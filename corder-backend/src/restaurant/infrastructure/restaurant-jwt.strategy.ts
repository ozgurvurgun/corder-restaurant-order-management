import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';
import { RestaurantTokenPayload } from '../application/restaurant-auth.service';
import { requireConfigSecret } from '../../common/security/env.validation';

@Injectable()
export class RestaurantJwtStrategy extends PassportStrategy(Strategy, 'restaurant-jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireConfigSecret(config, 'JWT_SECRET'),
    });
  }

  async validate(payload: RestaurantTokenPayload) {
    if (
      payload.type !== 'restaurant' ||
      !payload.restaurantId ||
      (payload.role !== 'root' && payload.role !== 'terminal')
    ) {
      throw new UnauthorizedException();
    }
    const restaurant = await this.restaurantRepo.findOne({
      where: { id: payload.restaurantId },
      select: { id: true, status: true, slug: true },
    });
    if (!restaurant || restaurant.status !== 'active') {
      throw new UnauthorizedException('Restaurant is not active');
    }
    return {
      restaurantId: restaurant.id,
      slug: restaurant.slug,
      sub: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      role: payload.role,
    };
  }
}
