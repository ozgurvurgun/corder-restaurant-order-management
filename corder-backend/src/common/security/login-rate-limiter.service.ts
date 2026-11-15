import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

interface RateBucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;
const MAX_BUCKETS_BEFORE_SWEEP = 5_000;

export function extractClientIp(req: Request): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return ip.trim() || 'unknown';
}

@Injectable()
export class LoginRateLimiterService {
  private readonly buckets = new Map<string, RateBucket>();

  consumeLoginAttempt(
    scope: 'restaurant' | 'platform',
    ip: string,
    email: string,
  ): void {
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    const key = `login:${scope}:${ip}:${normalizedEmail}`;
    this.consume(key);
  }

  consumePinAttempt(ip: string, restaurantId: string): void {
    const key = `pin:${ip}:${restaurantId}`;
    this.consume(key);
  }

  private consume(key: string): void {
    const now = Date.now();
    if (this.buckets.size >= MAX_BUCKETS_BEFORE_SWEEP) {
      this.sweepExpired(now);
    }
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return;
    }
    existing.count += 1;
    if (existing.count > MAX_ATTEMPTS_PER_WINDOW) {
      throw new HttpException(
        'Cok fazla giris denemesi. Lutfen bir dakika bekleyip tekrar deneyin.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private sweepExpired(now: number): void {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
