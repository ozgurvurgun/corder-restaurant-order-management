import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RootAdminEntity } from '../../platform/domain/root-admin.entity';
import { RestaurantEntity } from '../../platform/domain/restaurant.entity';

export interface RestaurantLoginDto {
  email: string;
  password: string;
}

export type RestaurantUserRole = 'root' | 'mudur' | 'kasiyer' | 'garson';

export interface RestaurantTokenPayload {
  sub: string;
  restaurantId: string;
  /** URL-safe; used for R2 /uploads paths. May be missing on older tokens. */
  slug?: string;
  email: string;
  name: string;
  type: 'restaurant';
  /** `root` = panel admin; `terminal` on terminal login. Missing on older JWTs. */
  role?: RestaurantUserRole | 'terminal';
}

@Injectable()
export class RestaurantAuthService {
  constructor(
    @InjectRepository(RootAdminEntity)
    private readonly rootAdminRepo: Repository<RootAdminEntity>,
    @InjectRepository(RestaurantEntity)
    private readonly restaurantRepo: Repository<RestaurantEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: RestaurantLoginDto): Promise<{
    accessToken: string;
    restaurant: { id: string; name: string; slug: string };
    user: { id: string; email: string; name: string; role: RestaurantUserRole };
  }> {
    const email = dto.email.toLowerCase().trim();

    // Panel: root admin (email + password)
    const admin = await this.rootAdminRepo.findOne({ where: { email }, relations: ['restaurant'] });
    if (admin?.restaurant) {
      if (await bcrypt.compare(dto.password, admin.passwordHash)) {
        const payload: RestaurantTokenPayload = {
          sub: admin.id,
          restaurantId: admin.restaurant.id,
          slug: admin.restaurant.slug,
          email: admin.email,
          name: admin.name,
          type: 'restaurant',
          role: 'root',
        };
        const accessToken = this.jwt.sign(payload, {
          secret: this.config.get('JWT_SECRET'),
          expiresIn: this.config.get('JWT_EXPIRES_IN', '7d'),
        });
        return {
          accessToken,
          restaurant: { id: admin.restaurant.id, name: admin.restaurant.name, slug: admin.restaurant.slug },
          user: { id: admin.id, email: admin.email, name: admin.name, role: 'root' },
        };
      }
    }

    // Terminal: restaurant's own login (unrelated to root admin)
    const restaurant = await this.restaurantRepo.findOne({ where: { terminalEmail: email } });
    if (restaurant?.terminalPasswordHash && (await bcrypt.compare(dto.password, restaurant.terminalPasswordHash))) {
      const payload: RestaurantTokenPayload = {
        sub: restaurant.id,
        restaurantId: restaurant.id,
        slug: restaurant.slug,
        email: restaurant.terminalEmail!,
        name: 'Terminal',
        type: 'restaurant',
        role: 'terminal',
      };
      const accessToken = this.jwt.sign(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '7d'),
      });
      return {
        accessToken,
        restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
        user: { id: restaurant.id, email: restaurant.terminalEmail!, name: 'Terminal', role: 'root' },
      };
    }

    throw new UnauthorizedException('Invalid email or password');
  }

}
