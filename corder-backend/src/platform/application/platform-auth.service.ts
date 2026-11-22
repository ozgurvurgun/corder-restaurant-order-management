import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PlatformAdminEntity } from '../domain/platform-admin.entity';
import { computeSecretFingerprint } from '../../restaurant/domain/services/billing-suspension.policy';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function decodeBase32Secret(rawSecret: string): Buffer | null {
  const cleaned = (rawSecret ?? '')
    .toUpperCase()
    .replace(/[\s\-=]+/g, '');
  if (!cleaned) return null;
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return bytes.length > 0 ? Buffer.from(bytes) : null;
}

export function computeTotpCode(
  secretBytes: Buffer,
  counter: number,
  digits = 6,
): string {
  const buf = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  buf.writeUInt32BE(high, 0);
  buf.writeUInt32BE(low, 4);
  const hmac = createHmac('sha1', secretBytes).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const mod = 10 ** digits;
  return String(binary % mod).padStart(digits, '0');
}

export function verifyTotpCode(
  secretBase32: string,
  candidateCode: string,
  nowMs: number = Date.now(),
  windowSteps = 1,
): boolean {
  const normalizedCode = (candidateCode ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalizedCode)) return false;
  const secretBytes = decodeBase32Secret(secretBase32);
  if (!secretBytes) return false;
  const currentStep = Math.floor(nowMs / 30_000);
  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const step = currentStep + delta;
    if (step < 0) continue;
    const expected = computeTotpCode(secretBytes, step, 6);
    if (timingSafeCodeMatches(normalizedCode, expected)) {
      return true;
    }
  }
  return false;
}

function timingSafeCodeMatches(candidate: string, expected?: string | null): boolean {
  const cleanCandidate = (candidate ?? '').trim();
  const cleanExpected = (expected ?? '').trim();
  if (!cleanCandidate || !cleanExpected) return false;
  const bufA = Buffer.from(cleanCandidate, 'utf8');
  const bufB = Buffer.from(cleanExpected, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function matchesAuthCodeOrTotp(candidate: string, envAuthCode?: string | null): boolean {
  const cleanCandidate = (candidate ?? '').trim();
  const cleanExpected = (envAuthCode ?? '').trim();
  if (!cleanCandidate || !cleanExpected) return false;
  if (verifyTotpCode(cleanExpected, cleanCandidate)) {
    return true;
  }
  const compactCandidate = cleanCandidate.replace(/[\s-]+/g, '').toUpperCase();
  const compactExpected = cleanExpected.replace(/[\s-]+/g, '').toUpperCase();
  return (
    timingSafeCodeMatches(cleanCandidate, cleanExpected) ||
    timingSafeCodeMatches(compactCandidate, compactExpected)
  );
}

function normalizePlatformAdminEmail(rawEmail?: string | null): string {
  const trimmed = (rawEmail ?? '').trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed;
  return `${trimmed}@corder.app`;
}

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
    const normalizedEmail = normalizePlatformAdminEmail(email);
    if (!normalizedEmail || !password) return null;
    const admin = await this.repo.findOne({ where: { email: normalizedEmail } });
    if (!admin) return null;
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (ok) return admin;
    if (timingSafeCodeMatches(password, process.env.PLATFORM_ADMIN_PASSWORD)) {
      return admin;
    }
    return null;
  }

  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<{ verified: true; email: string; name: string }> {
    const admin = await this.validateAdmin(email, password);
    if (!admin) {
      throw new UnauthorizedException(
        'Geçersiz yönetici kullanıcı adı veya parola',
      );
    }
    return {
      verified: true,
      email: admin.email,
      name: admin.name,
    };
  }

  private isAuthCodeValid(rawCode: string): boolean {
    const code = (rawCode ?? '').trim();
    const envAuthCode = process.env.PLATFORM_ADMIN_AUTH_CODE?.trim();
    if (!code || !envAuthCode) return false;
    return matchesAuthCodeOrTotp(code, envAuthCode);
  }

  async login(
    dto: PlatformLoginInput,
  ): Promise<{
    accessToken: string;
    admin: { id: string; email: string; name: string };
  }> {
    if (!dto.email?.trim() || !dto.password || !dto.authCode?.trim()) {
      throw new UnauthorizedException(
        'Yönetici kullanıcı adı, parola ve Google Authenticator / Auth kodu zorunludur',
      );
    }

    const admin = await this.validateAdmin(dto.email, dto.password);
    if (!admin) {
      throw new UnauthorizedException(
        'Geçersiz yönetici kullanıcı adı veya parola',
      );
    }

    if (!this.isAuthCodeValid(dto.authCode)) {
      throw new UnauthorizedException('Geçersiz Platform Admin Auth Kodu');
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
