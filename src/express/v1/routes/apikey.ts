import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { RequestLog } from '../../../lib/models/requestlog.model';
import { sequelize } from '../../../lib/models/database';
import { RequestWithRateLimit } from '../types/request';

const router = Router();

interface UsageStats {
  totalRequests: number;
  last24h: number;
  last7d: number;
  last30d: number;
  blockedRequests: number;
  avgResponseTimeMs: number | null;
  topEndpoints: { path: string; count: number }[];
}

async function getUsageStats(apiKeyId: string): Promise<UsageStats> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalRequests, last24h, last7d, last30d, blockedRequests, avgResponseTime, topEndpoints] =
    await Promise.all([
      RequestLog.count({ where: { apiKeyId } }),
      RequestLog.count({ where: { apiKeyId, timestamp: { [Op.gte]: oneDayAgo } } }),
      RequestLog.count({ where: { apiKeyId, timestamp: { [Op.gte]: sevenDaysAgo } } }),
      RequestLog.count({ where: { apiKeyId, timestamp: { [Op.gte]: thirtyDaysAgo } } }),
      RequestLog.count({ where: { apiKeyId, wasBlocked: true } }),
      sequelize.query(
        `SELECT AVG(response_time_ms) as avgTime 
         FROM request_logs 
         WHERE api_key_id = :apiKeyId AND response_time_ms IS NOT NULL`,
        {
          replacements: { apiKeyId },
          type: 'SELECT',
        },
      ) as Promise<{ avgTime: number | null }[]>,
      sequelize.query(
        `SELECT path, COUNT(*) as count 
         FROM request_logs 
         WHERE api_key_id = :apiKeyId 
         GROUP BY path 
         ORDER BY count DESC 
         LIMIT 5`,
        {
          replacements: { apiKeyId },
          type: 'SELECT',
        },
      ) as Promise<{ path: string; count: number }[]>,
    ]);

  return {
    totalRequests,
    last24h,
    last7d,
    last30d,
    blockedRequests,
    avgResponseTimeMs:
      avgResponseTime?.[0]?.avgTime != null
        ? Math.round(Number(avgResponseTime[0].avgTime) * 100) / 100
        : null,
    topEndpoints: topEndpoints.map((ep) => ({
      path: ep.path,
      count: Number(ep.count),
    })),
  };
}

// GET /v1/apikey - Get info about the current API key
router.get('/', async (req: Request, res: Response) => {
  const request = req as RequestWithRateLimit;

  if (!request.apiKey) {
    return res.error('UNAUTHORIZED', 'API key required to access this endpoint', 401);
  }

  try {
    const includeUsage = req.query.usage !== 'false';

    const keyInfo: {
      id: string;
      name: string;
      email: string | null;
      tier: string;
      rateLimit: number;
      isActive: boolean;
      requestCount: number;
      lastUsedAt: Date | null;
      createdAt: Date;
      usage?: UsageStats;
    } = {
      id: request.apiKey.id,
      name: request.apiKey.name,
      email: request.apiKey.email,
      tier: request.apiKey.tier,
      rateLimit: request.apiKey.rateLimit,
      isActive: request.apiKey.isActive,
      requestCount: request.apiKey.requestCount,
      lastUsedAt: request.apiKey.lastUsedAt,
      createdAt: request.apiKey.createdAt,
    };

    if (includeUsage) {
      keyInfo.usage = await getUsageStats(request.apiKey.id);
    }

    return res.success(keyInfo);
  } catch (error) {
    console.error('Error fetching API key info:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch API key info', 500);
  }
});

// GET /v1/apikey/usage - Get detailed usage stats for the current API key
router.get('/usage', async (req: Request, res: Response) => {
  const request = req as RequestWithRateLimit;

  if (!request.apiKey) {
    return res.error('UNAUTHORIZED', 'API key required to access this endpoint', 401);
  }

  try {
    const usage = await getUsageStats(request.apiKey.id);
    return res.success(usage);
  } catch (error) {
    console.error('Error fetching API key usage:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch API key usage', 500);
  }
});

// GET /v1/apikey/logs - Get recent request logs for the current API key
router.get('/logs', async (req: Request, res: Response) => {
  const request = req as RequestWithRateLimit;

  if (!request.apiKey) {
    return res.error('UNAUTHORIZED', 'API key required to access this endpoint', 401);
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const logs = await RequestLog.findAll({
      where: { apiKeyId: request.apiKey.id },
      order: [['timestamp', 'DESC']],
      limit,
      attributes: [
        'requestId',
        'timestamp',
        'method',
        'path',
        'responseStatus',
        'responseTimeMs',
        'wasBlocked',
        'blockReason',
      ],
    });

    return res.success({
      count: logs.length,
      logs: logs.map((log) => ({
        requestId: log.requestId,
        timestamp: log.timestamp,
        method: log.method,
        path: log.path,
        responseStatus: log.responseStatus,
        responseTimeMs: log.responseTimeMs,
        wasBlocked: log.wasBlocked,
        blockReason: log.blockReason,
      })),
    });
  } catch (error) {
    console.error('Error fetching API key logs:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch API key logs', 500);
  }
});

export default router;
