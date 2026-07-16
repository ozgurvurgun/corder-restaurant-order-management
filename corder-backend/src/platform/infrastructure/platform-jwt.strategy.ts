import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformAdminEntity } from '../domain/platform-admin.entity';
import { PlatformTokenPayload } from '../application/platform-auth.service';

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(PlatformAdminEntity)
    private readonly adminRepo: Repository<PlatformAdminEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('PLATFORM_JWT_SECRET', 'platform-secret'),
    });
  }

  async validate(payload: PlatformTokenPayload): Promise<PlatformAdminEntity> {
    if (payload.type !== 'platform') throw new UnauthorizedException();
    const admin = await this.adminRepo.findOne({ where: { id: payload.sub } });
    if (!admin) throw new UnauthorizedException();
    return admin;
  }
}
