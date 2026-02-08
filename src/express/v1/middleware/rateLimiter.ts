import { Request, Response, NextFunction } from 'express';
import { RequestWithRateLimit } from '../types/request';
import { RequestLog } from '../../../lib/models/requestlog.model';
import { getClientIp } from '../utils/getClientIp';
import {
  trackRateLimitExceeded,
  trackSuccessfulRequest,
  checkAbuseAfterRequest,
} from './abuseBlock';

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

  // Determine rate limit based on authentication
  let limit: number;
  let identifier: string;
  let identifierType: 'api-key' | 'ip';

  if (request.apiKey) {
    // Authenticated user: use API key limits
    limit = request.apiKey.rateLimit;
    identifier = `key:${request.apiKey.id}`;
    identifierType = 'api-key';
  } else {
    // Anonymous user: IP-based limiting
    limit = 100; // 100 requests per hour for anonymous
    const ip = getClientIp(request);
    identifier = `ip:${ip}`;
    identifierType = 'ip';
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
  const referer = request.get('referer') || request.get('referrer');
  const ccServer = request.get('x-cc-srv');
  const ccComputerId = request.get('x-cc-id')
    ? parseInt(request.get('x-cc-id') as string, 10)
    : undefined;
  const tier = (request.apiKey?.tier || 'anonymous') as
    | 'anonymous'
    | 'free'
    | 'premium'
    | 'shopsync'
    | 'enderstorage'
    | 'internal';

  // Track request start time
  const startTime = Date.now();

  // Track successful request for abuse detection (burst/UA cycling)
  trackSuccessfulRequest(ip, userAgent);

  // Log to database after response finishes
  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]): Response {
    const responseTimeMs = Date.now() - startTime;

    // Log to database (async, don't wait)
    RequestLog.logRequest({
      requestId: request.requestId,
      method: req.method,
      path: req.originalUrl,
      ipAddress: ip,
      userAgent,
      referer,
      ccServer,
      ccComputerId: Number.isNaN(ccComputerId) ? undefined : ccComputerId,
      apiKeyId: request.apiKey?.id,
      tier,
      rateLimitCount: current.count,
      rateLimitLimit: limit,
      rateLimitRemaining: remaining,
      rateLimitResetAt: new Date(current.resetAt),
      wasBlocked: false,
      responseStatus: res.statusCode,
      responseTimeMs,
    }).catch((err) => console.error('Failed to log request:', err));

    // Check for abuse patterns after request (async, don't wait)
    checkAbuseAfterRequest(ip).catch((err) =>
      console.error('Failed to check abuse after request:', err),
    );

    return originalEnd.apply(this, args as any) as Response;
  };

  // Check if limit exceeded
  if (current.count > limit) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());

    // Log blocked request to database
    RequestLog.logRequest({
      requestId: request.requestId,
      method: req.method,
      path: req.originalUrl,
      ipAddress: ip,
      userAgent,
      referer,
      ccServer,
      ccComputerId: Number.isNaN(ccComputerId) ? undefined : ccComputerId,
      apiKeyId: request.apiKey?.id,
      tier,
      rateLimitCount: current.count,
      rateLimitLimit: limit,
      rateLimitRemaining: remaining,
      rateLimitResetAt: new Date(current.resetAt),
      wasBlocked: true,
      blockReason: 'RATE_LIMIT_EXCEEDED',
      responseStatus: 429,
    }).catch((err) => console.error('Failed to log blocked request:', err));

    // Track rate limit exceeded for abuse detection (async, don't wait)
    trackRateLimitExceeded(ip, userAgent).catch((err) =>
      console.error('Failed to track rate limit exceeded:', err),
    );

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
