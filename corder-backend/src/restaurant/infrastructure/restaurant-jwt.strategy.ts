import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RestaurantTokenPayload } from '../application/restaurant-auth.service';

@Injectable()
export class RestaurantJwtStrategy extends PassportStrategy(Strategy, 'restaurant-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: RestaurantTokenPayload) {
    if (payload.type !== 'restaurant') throw new UnauthorizedException();
    const role =
      payload.role ??
      (payload.sub === payload.restaurantId ? ('terminal' as const) : ('root' as const));
    return {
      restaurantId: payload.restaurantId,
      slug: payload.slug,
      sub: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      role,
    };
  }
}
