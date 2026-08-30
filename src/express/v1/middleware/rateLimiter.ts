import { Request, Response, NextFunction } from 'express';
import { RequestWithRateLimit } from '../types/request';
import { RequestLog } from '#lib/models/requestlog.model';
import { getClientIp } from '../utils/getClientIp';
import { isIgnoredIp } from '../utils/ignoredIps';
import { createLogger } from '#lib/logger';
import {
  trackRateLimitExceeded,
  trackSuccessfulRequest,
  checkAbuseAfterRequest,
} from './abuseBlock';

const log = createLogger('RateLimit');

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

// Cleanup old entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    Object.keys(store).forEach((key) => {
      if (store[key].resetAt < now) {
        delete store[key];
      }
    });
  },
  5 * 60 * 1000,
);

export const rateLimiterMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const request = req as RequestWithRateLimit;
  const clientIp = getClientIp(request);

  // Skip rate limiting for ignored IPs
  if (isIgnoredIp(clientIp)) {
    request.rateLimit = {
      limit: Infinity,
      remaining: Infinity,
      reset: 0,
    };
    return next();
  }

  // Determine rate limit based on authentication
  let limit: number;
  let identifier: string;

  if (request.apiKey) {
    // Authenticated user: use API key limits
    limit = request.apiKey.rateLimit;
    identifier = `key:${request.apiKey.id}`;
  } else {
    // Anonymous user: IP-based limiting
    limit = 100; // 100 requests per hour for anonymous
    const ip = getClientIp(request);
    identifier = `ip:${ip}`;
  }

  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour

  // Initialize or get current window
  if (!store[identifier] || store[identifier].resetAt < now) {
    store[identifier] = {
      count: 0,
      resetAt: now + windowMs,
    };
  }

  const current = store[identifier];
  current.count += 1;

  // Set rate limit headers
  const remaining = Math.max(0, limit - current.count);
  const reset = Math.ceil(current.resetAt / 1000);

  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', remaining.toString());
  res.setHeader('X-RateLimit-Reset', reset.toString());

  // Store for response formatter
  request.rateLimit = {
    limit,
    remaining,
    reset,
  };

  const ip = getClientIp(request);
  const userAgent = request.get('user-agent');
  let wasRateLimited = false;
  const tier = (request.apiKey?.tier || 'anonymous') as
    | 'anonymous'
    | 'free'
    | 'premium'
    | 'shopsync'
    | 'enderstorage'
    | 'worker'
    | 'internal';

  // Only track IP-level abuse for unauthenticated (anonymous) requests.
  // Authenticated API key users have their own per-key rate limit, so their
  // traffic volume should not count against IP-level burst/UA cycling detection.
  if (!request.apiKey) {
    trackSuccessfulRequest(ip, userAgent);
  }

  // Log to database after response finishes
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]): Response {
    if (!wasRateLimited) {
      // Log to database (async, don't wait)
      RequestLog.logRequest({
        ipAddress: ip,
        apiKeyId: request.apiKey?.id,
        tier,
        wasBlocked: false,
      }).catch((err) => log.error('Failed to log request:', err));
    }

    // Check for abuse patterns after request (async, don't wait)
    // Skip for authenticated API key users — their high rate limits are intentional.
    if (!request.apiKey && !wasRateLimited) {
      checkAbuseAfterRequest(ip).catch((err) =>
        log.error('Failed to check abuse after request:', err),
      );
    }

    return originalEnd.apply(this, args as any) as Response;
  };

  // Check if limit exceeded
  if (current.count > limit) {
    wasRateLimited = true;
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());

    // Log blocked request to database
    RequestLog.logRequest({
      ipAddress: ip,
      apiKeyId: request.apiKey?.id,
      tier,
      wasBlocked: true,
      blockReason: 'RATE_LIMIT_EXCEEDED',
    }).catch((err) => log.error('Failed to log blocked request:', err));

    // Track rate limit exceeded for abuse detection (async, don't wait)
    // Only track for anonymous users — authenticated keys have intentionally high limits.
    if (!request.apiKey) {
      trackRateLimitExceeded(ip, userAgent).catch((err) =>
        log.error('Failed to track rate limit exceeded:', err),
      );
    }

    return res.error(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      429,
      {
        limit,
        resetAt: new Date(current.resetAt).toISOString(),
      },
    );
  }

  next();
};
