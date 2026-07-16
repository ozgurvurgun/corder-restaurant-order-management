import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { PlatformAdminEntity } from '../domain/platform-admin.entity';

export interface PlatformLoginDto {
  email: string;
  password: string;
}

export interface PlatformTokenPayload {
  sub: string;
  email: string;
  type: 'platform';
}

@Injectable()
export class PlatformAuthService {
  constructor(
    @InjectRepository(PlatformAdminEntity)
    private readonly repo: Repository<PlatformAdminEntity>,
    private readonly jwt: JwtService,
  ) {}

  async validateAdmin(email: string, password: string): Promise<PlatformAdminEntity | null> {
    const admin = await this.repo.findOne({ where: { email: email.toLowerCase() } });
    if (!admin) return null;
    const ok = await bcrypt.compare(password, admin.passwordHash);
    return ok ? admin : null;
  }

  async login(dto: PlatformLoginDto): Promise<{ accessToken: string; admin: { id: string; email: string; name: string } }> {
    const admin = await this.validateAdmin(dto.email, dto.password);
    if (!admin) throw new UnauthorizedException('Invalid email or password');
    const payload: PlatformTokenPayload = {
      sub: admin.id,
      email: admin.email,
      type: 'platform',
    };
    const accessToken = this.jwt.sign(payload);
    return {
      accessToken,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }
}
