import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

interface RateBucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;
const PIN_STAFF_WINDOW_MS = 5 * 60_000;
const MAX_PIN_ATTEMPTS_PER_STAFF = 5;
const MAX_BUCKETS_BEFORE_SWEEP = 5_000;

export function extractClientIp(req: Request): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return ip.trim() || 'unknown';
}

/**
 * In-memory brute-force rate limiter for login and terminal PIN verification.
 * Note: For horizontal multi-instance deployments without sticky sessions,
 * back this store with Redis (or enforce upstream rate limits at Nginx/Cloudflare).
 */
@Injectable()
export class LoginRateLimiterService {
  private readonly buckets = new Map<string, RateBucket>();

  consumeLoginAttempt(
    scope: 'restaurant' | 'platform' | 'print-agent',
    ip: string,
    email: string,
  ): void {
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    const key = `login:${scope}:${ip}:${normalizedEmail}`;
    this.consume(key, WINDOW_MS, MAX_ATTEMPTS_PER_WINDOW);
  }

  resetLoginAttempts(
    scope: 'restaurant' | 'platform' | 'print-agent',
    ip: string,
    email: string,
  ): void {
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    this.buckets.delete(`login:${scope}:${ip}:${normalizedEmail}`);
  }

  consumePinAttempt(ip: string, restaurantId: string, staffId?: string): void {
    const normalizedStaffId = staffId?.trim().toLowerCase();
    if (normalizedStaffId) {
      const staffLockMsg =
        'Too many failed PIN attempts for this staff member. Please wait 5 minutes and try again.';
      this.consume(
        `pin:staff:${restaurantId}:${normalizedStaffId}`,
        PIN_STAFF_WINDOW_MS,
        MAX_PIN_ATTEMPTS_PER_STAFF,
        staffLockMsg,
      );
      this.consume(
        `pin:ip-staff:${ip}:${restaurantId}:${normalizedStaffId}`,
        PIN_STAFF_WINDOW_MS,
        MAX_PIN_ATTEMPTS_PER_STAFF,
        staffLockMsg,
      );
    }

    const ipKey = `pin:ip:${ip}:${restaurantId}`;
    this.consume(ipKey, WINDOW_MS, MAX_ATTEMPTS_PER_WINDOW);
  }

  resetPinAttempts(ip: string, restaurantId: string, staffId?: string): void {
    const normalizedStaffId = staffId?.trim().toLowerCase();
    if (normalizedStaffId) {
      this.buckets.delete(`pin:staff:${restaurantId}:${normalizedStaffId}`);
      this.buckets.delete(`pin:ip-staff:${ip}:${restaurantId}:${normalizedStaffId}`);
    }
  }

  private consume(
    key: string,
    windowMs: number,
    maxAttempts: number,
    errorMessage = 'Too many login attempts. Please wait one minute and try again.',
  ): void {
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.ensureCapacity(now);
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    existing.count += 1;
    if (existing.count > maxAttempts) {
      throw new HttpException(errorMessage, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private ensureCapacity(now: number): void {
    if (this.buckets.size < MAX_BUCKETS_BEFORE_SWEEP) {
      return;
    }
    this.sweepExpired(now);
    while (this.buckets.size >= MAX_BUCKETS_BEFORE_SWEEP) {
      const oldestKey = this.buckets.keys().next().value;
      if (oldestKey === undefined) break;
      this.buckets.delete(oldestKey);
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
