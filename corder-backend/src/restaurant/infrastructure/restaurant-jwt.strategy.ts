import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { RestaurantTokenPayload } from '../domain/services/billing-suspension.policy';
import { RestaurantSessionValidatorService } from '../application/restaurant-session-validator.service';
import { requireConfigSecret } from '../../common/security/env.validation';

@Injectable()
export class RestaurantJwtStrategy extends PassportStrategy(Strategy, 'restaurant-jwt') {
  constructor(
    config: ConfigService,
    private readonly sessionValidator: RestaurantSessionValidatorService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireConfigSecret(config, 'JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: RestaurantTokenPayload) {
    const reqPath = (req.originalUrl || req.url || '').toLowerCase();
    const headerRestId = req.headers['x-restaurant-id'];
    const explicitHeaderId = Array.isArray(headerRestId)
      ? headerRestId[0]?.trim()
      : headerRestId?.trim();
    const switchBodyId =
      reqPath.includes('/restaurant/auth/switch-branch') &&
      typeof (req.body as { restaurantId?: unknown } | undefined)?.restaurantId === 'string'
        ? ((req.body as { restaurantId: string }).restaurantId || '').trim()
        : '';

    return this.sessionValidator.validateHttpPrincipal(payload, {
      requestedRestaurantId: explicitHeaderId || switchBodyId,
      isBossMultiBranchRoute:
        reqPath.includes('/restaurant/auth/me') ||
        reqPath.includes('/restaurant/auth/switch-branch') ||
        reqPath.includes('/restaurant/boss'),
      isBillingInspectionRoute:
        req.method === 'GET' && reqPath.includes('/restaurant/settings/billing'),
      isOpeningNewShift:
        req.method === 'POST' && /\/restaurant\/shifts(?:\?|$)/.test(reqPath),
    });
  }
}
