import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Lightweight in-memory fixed-window rate limiter for the login endpoint.
 * Zero dependencies; keyed by client IP + submitted email. Sufficient for
 * slowing credential-stuffing in a single-instance dev/small deployment.
 * For multi-instance production, replace with a shared store (Redis).
 */
@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private readonly windowMs = 60_000;
  private readonly maxAttempts = 5;
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = this.clientKey(req);
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      this.sweep(now);
      return true;
    }

    if (bucket.count >= this.maxAttempts) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      throw new HttpException(
        {
          message: `Too many login attempts. Try again in ${retryAfter}s.`,
          error: { code: 'TOO_MANY_REQUESTS' },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    return true;
  }

  private clientKey(req: Request): string {
    const forwarded = (req.headers['x-forwarded-for'] as string)
      ?.split(',')[0]
      ?.trim();
    const ip = forwarded || req.socket?.remoteAddress || 'unknown';
    const body = req.body as { email?: unknown } | undefined;
    const email =
      typeof body?.email === 'string' ? body.email.toLowerCase() : '';
    return `${ip}|${email}`;
  }

  /** Opportunistically drop expired buckets so the map can't grow unbounded. */
  private sweep(now: number): void {
    if (this.buckets.size < 5000) return;
    for (const [k, v] of this.buckets) {
      if (now >= v.resetAt) this.buckets.delete(k);
    }
  }
}
