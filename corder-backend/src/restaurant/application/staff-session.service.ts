import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { RestaurantStaffEntity, StaffRole } from '../domain/restaurant-staff.entity';
import {
  DEFAULT_JWT_EXPIRES_IN,
  requireConfigSecret,
} from '../../common/security/env.validation';

export interface StaffSessionTokenPayload {
  typ: 'staff_session';
  sub: string;
  restaurantId: string;
  name: string;
  role: StaffRole;
}

export interface VerifiedStaffIdentity {
  staffId: string;
  name: string;
  role: StaffRole;
}

@Injectable()
export class StaffSessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RestaurantStaffEntity)
    private readonly staffRepo: Repository<RestaurantStaffEntity>,
  ) {}

  signStaffToken(staff: {
    id: string;
    restaurantId: string;
    name: string;
    role: StaffRole;
  }): string {
    const payload: StaffSessionTokenPayload = {
      typ: 'staff_session',
      sub: staff.id,
      restaurantId: staff.restaurantId,
      name: staff.name,
      role: staff.role,
    };
    return this.jwt.sign(payload, {
      secret: requireConfigSecret(this.config, 'JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN', DEFAULT_JWT_EXPIRES_IN),
    });
  }

  async requireFromRequest(
    req: Request,
    restaurantId: string,
  ): Promise<VerifiedStaffIdentity> {
    const raw = req.headers['x-staff-token'];
    const token = Array.isArray(raw) ? raw[0]?.trim() : raw?.trim();
    if (!token) {
      throw new UnauthorizedException('Personel PIN dogrulamasi gerekli');
    }
    return this.verifyToken(token, restaurantId);
  }

  async resolveOptionalFromRequest(
    req: Request,
    restaurantId: string,
  ): Promise<VerifiedStaffIdentity | null> {
    const raw = req.headers['x-staff-token'];
    const token = Array.isArray(raw) ? raw[0]?.trim() : raw?.trim();
    if (!token) return null;
    return this.verifyToken(token, restaurantId);
  }

  private async verifyToken(
    token: string,
    restaurantId: string,
  ): Promise<VerifiedStaffIdentity> {
    let payload: StaffSessionTokenPayload;
    try {
      payload = this.jwt.verify<StaffSessionTokenPayload>(token, {
        secret: requireConfigSecret(this.config, 'JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Gecersiz veya suresi dolmus personel oturumu');
    }
    if (
      payload.typ !== 'staff_session' ||
      !payload.sub ||
      payload.restaurantId !== restaurantId
    ) {
      throw new UnauthorizedException('Gecersiz personel oturumu');
    }
    const staff = await this.staffRepo.findOne({
      where: { id: payload.sub, restaurantId, isActive: true },
    });
    if (!staff) {
      throw new UnauthorizedException('Personel bulunamadi veya pasif');
    }
    return {
      staffId: staff.id,
      name: staff.name,
      role: staff.role,
    };
  }
}
