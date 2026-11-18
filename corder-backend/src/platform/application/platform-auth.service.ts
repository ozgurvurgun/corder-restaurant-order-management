import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { PlatformAdminEntity } from '../domain/platform-admin.entity';
import { computeSecretFingerprint } from '../../restaurant/domain/services/billing-suspension.policy';

export interface PlatformLoginInput {
  email?: string;
  password?: string;
  authCode?: string;
}

export interface PlatformTokenPayload {
  sub: string;
  email: string;
  type: 'platform';
  pwdFp?: string;
}

@Injectable()
export class PlatformAuthService {
  constructor(
    @InjectRepository(PlatformAdminEntity)
    private readonly repo: Repository<PlatformAdminEntity>,
    private readonly jwt: JwtService,
  ) {}

  async validateAdmin(
    email: string,
    password: string,
  ): Promise<PlatformAdminEntity | null> {
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    if (!normalizedEmail || !password) return null;
    const admin = await this.repo.findOne({ where: { email: normalizedEmail } });
    if (!admin) return null;
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (ok) return admin;
    const envCode = process.env.PLATFORM_ADMIN_AUTH_CODE?.trim();
    if (envCode && password.trim() === envCode) {
      return admin;
    }
    return null;
  }

  private async validateByAuthCode(
    rawCode: string,
  ): Promise<PlatformAdminEntity | null> {
    const code = (rawCode ?? '').trim();
    if (!code) return null;

    const envAuthCode = process.env.PLATFORM_ADMIN_AUTH_CODE?.trim();
    const envPassword = process.env.PLATFORM_ADMIN_PASSWORD?.trim();
    const allAdmins = await this.repo.find({ order: { createdAt: 'ASC' } });

    const matchesEnv =
      (Boolean(envAuthCode) && code === envAuthCode) ||
      (Boolean(envPassword) && code === envPassword);

    if (matchesEnv) {
      if (allAdmins.length > 0) {
        return allAdmins[0];
      }
      const defaultEmail =
        process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase() ||
        'admin@corder.app';
      const passwordHash = await bcrypt.hash(code, 10);
      return this.repo.save(
        this.repo.create({
          email: defaultEmail,
          name: 'Platform Admin',
          passwordHash,
        }),
      );
    }

    for (const admin of allAdmins) {
      if (await bcrypt.compare(code, admin.passwordHash)) {
        return admin;
      }
    }
    return null;
  }

  async login(
    dto: PlatformLoginInput,
  ): Promise<{
    accessToken: string;
    admin: { id: string; email: string; name: string };
  }> {
    let admin: PlatformAdminEntity | null = null;
    if (dto.authCode?.trim()) {
      admin = await this.validateByAuthCode(dto.authCode);
    } else if (dto.email?.trim() && dto.password) {
      admin = await this.validateAdmin(dto.email, dto.password);
    } else if (dto.password?.trim()) {
      admin = await this.validateByAuthCode(dto.password);
    }

    if (!admin) {
      throw new UnauthorizedException('Geçersiz yetki kodu veya kimlik bilgisi');
    }

    const payload: PlatformTokenPayload = {
      sub: admin.id,
      email: admin.email,
      type: 'platform',
      pwdFp: computeSecretFingerprint(admin.passwordHash),
    };
    const accessToken = this.jwt.sign(payload);
    return {
      accessToken,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }
}
