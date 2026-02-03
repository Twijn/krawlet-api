import { Request, Response, NextFunction } from 'express';
import {
  isIpBlocked,
  recordRequest,
  checkForAbuse,
  blockIpForAbuse,
} from '../../../lib/abuseManager';
import { getClientIp } from '../utils/getClientIp';

/**
 * Middleware to check for blocked IPs and detect abuse patterns
 * Should run BEFORE the rate limiter middleware
 */
export const abuseBlockMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const ip = getClientIp(req);

  try {
    // Check if IP is currently blocked
    const block = await isIpBlocked(ip);
    if (block) {
      // Record the blocked attempt
      block
        .recordBlockedRequest()
        .catch((err: Error) => console.error('Failed to record blocked request:', err));

      // Return 403 for blocked IPs (or 444 equivalent - just close connection)
      // Using 403 with a clear message is more user-friendly
      res.status(403).json({
        success: false,
        error: {
          code: 'IP_BLOCKED',
          message: 'Your IP address has been temporarily blocked due to abusive behavior.',
          details: {
            reason: block.reason,
            blockLevel: block.blockLevel,
            expiresAt: block.expiresAt?.toISOString() || null,
            blockedAt: block.createdAt.toISOString(),
          },
        },
      });
      return;
    }

    // Continue to next middleware
    next();
  } catch (err) {
    console.error('Error in abuse block middleware:', err);
    // On error, allow the request through (fail open)
    next();
  }
};

/**
 * Post-response middleware to track 429s and detect abuse
 * Should be called from the rate limiter after sending a 429 response
 */
export const trackRateLimitExceeded = async (
  ip: string,
  userAgent: string | undefined,
): Promise<void> => {
  try {
    // Record the 429 response
    recordRequest(ip, userAgent, true);

    // Check if this triggers abuse detection
    const abuseResult = await checkForAbuse(ip);
    if (abuseResult?.shouldBlock) {
      // Block the IP
      await blockIpForAbuse(ip, abuseResult.reason, abuseResult.triggerType, abuseResult.metadata);
    }
  } catch (err) {
    console.error('Error tracking rate limit exceeded:', err);
  }
};

/**
 * Track successful requests for burst detection
 */
export const trackSuccessfulRequest = (ip: string, userAgent: string | undefined): void => {
  recordRequest(ip, userAgent, false);
};

/**
 * Async check for abuse after successful request (for burst/UA cycling detection)
 */
export const checkAbuseAfterRequest = async (ip: string): Promise<void> => {
  try {
    const abuseResult = await checkForAbuse(ip);
    if (abuseResult?.shouldBlock) {
      await blockIpForAbuse(ip, abuseResult.reason, abuseResult.triggerType, abuseResult.metadata);
    }
  } catch (err) {
    console.error('Error checking abuse after request:', err);
  }
};
