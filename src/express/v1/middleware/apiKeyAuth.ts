import { Request, Response, NextFunction } from 'express';
import { ApiKey } from '../../../lib/models/apikey.model';
import { RequestWithRateLimit } from '../types/request';
import { RequestLog } from '../../../lib/models/requestlog.model';
import { getClientIp } from '../utils/getClientIp';
import { createLogger } from '../../../lib/logger';

const log = createLogger('Auth');

export const optionalApiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const request = req as RequestWithRateLimit;
  const authHeader = req.headers.authorization;
  const ip = getClientIp(req);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No API key provided - continue as anonymous
    return next();
  }

  const providedKey = authHeader.substring(7); // Remove 'Bearer '

  if (!providedKey.startsWith('kraw_')) {
    // Log blocked request to database
    RequestLog.logRequest({
      ipAddress: ip,
      tier: 'anonymous',
      wasBlocked: true,
      blockReason: 'INVALID_API_KEY_FORMAT',
    }).catch((err) => log.error('Failed to log blocked request:', err));

    return res.error('INVALID_API_KEY', 'API key must start with "kraw_"', 401);
  }

  try {
    const hashedKey = ApiKey.hashKey(providedKey);
    const apiKey = await ApiKey.findOne({
      where: {
        key: hashedKey,
        isActive: true,
      },
    });

    if (!apiKey) {
      // Log blocked request to database
      RequestLog.logRequest({
        ipAddress: ip,
        tier: 'anonymous',
        wasBlocked: true,
        blockReason: 'INVALID_API_KEY',
      }).catch((err) => log.error('Failed to log blocked request:', err));

      return res.error('INVALID_API_KEY', 'Invalid or inactive API key', 401);
    }

    // Attach API key info to request
    request.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      email: apiKey.email,
      tier: apiKey.tier,
      rateLimit: apiKey.rateLimit,
      isActive: apiKey.isActive,
      requestCount: apiKey.requestCount,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
      mcUuid: apiKey.mcUuid,
      mcName: apiKey.mcName,
      estorageEntityId: apiKey.estorageEntityId,
    };

    // Update usage (async, don't wait)
    apiKey.incrementUsage().catch((err) => log.error(err));

    next();
  } catch (error) {
    console.error('Error validating API key:', error);
    return res.error('INTERNAL_ERROR', 'Error validating API key', 500);
  }
};

// For routes that REQUIRE authentication
export const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
  const request = req as RequestWithRateLimit;

  if (!request.apiKey) {
    return res.error(
      'UNAUTHORIZED',
      'This endpoint requires an API key. Include it in the Authorization header: "Bearer kraw_your_key_here"',
      401,
    );
  }

  next();
};
