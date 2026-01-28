import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { RequestLog } from '../../../lib/models/requestlog.model';
import { ApiKey } from '../../../lib/models/apikey.model';
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

// POST /v1/apikey/quickcode/redeem - Redeem a quick code for a full API key
router.post('/quickcode/redeem', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.error('INVALID_REQUEST', 'Quick code is required', 400);
    }

    // Normalize the code (remove spaces/dashes, pad with leading zeros)
    const normalizedCode = code.replace(/[\s-]/g, '').padStart(6, '0');

    if (!/^\d{6}$/.test(normalizedCode)) {
      return res.error('INVALID_REQUEST', 'Quick code must be a 6-digit number', 400);
    }

    const apiKey = await ApiKey.findByQuickCode(normalizedCode);

    if (!apiKey) {
      return res.error('NOT_FOUND', 'Invalid or expired quick code', 404);
    }

    // Generate a new raw key for the user
    const rawKey = ApiKey.generateKey();
    const hashedKey = ApiKey.hashKey(rawKey);

    // Update the key and clear the quick code
    apiKey.key = hashedKey;
    apiKey.qcCode = null;
    apiKey.qcExpires = null;
    await apiKey.save();

    return res.success({
      message: 'Quick code redeemed successfully',
      apiKey: rawKey,
      name: apiKey.name,
      tier: apiKey.tier,
      rateLimit: apiKey.rateLimit,
      warning: 'Save this API key securely - it will not be shown again!',
    });
  } catch (error) {
    console.error('Error redeeming quick code:', error);
    return res.error('INTERNAL_ERROR', 'Failed to redeem quick code', 500);
  }
});

// POST /v1/apikey/quickcode/generate - Generate a quick code for an existing API key
router.post('/quickcode/generate', async (req: Request, res: Response) => {
  const request = req as RequestWithRateLimit;

  if (!request.apiKey) {
    return res.error('UNAUTHORIZED', 'API key required to generate a quick code', 401);
  }

  try {
    // Fetch the full ApiKey model instance to use model methods
    const apiKey = await ApiKey.findByPk(request.apiKey.id);

    if (!apiKey) {
      return res.error('NOT_FOUND', 'API key not found', 404);
    }

    const code = await apiKey.setQuickCode();

    return res.success({
      quickCode: code,
      expiresAt: apiKey.qcExpires,
      expiresIn: '15 minutes',
      message: 'Use this code to retrieve your full API key. Redeeming will regenerate your key.',
    });
  } catch (error) {
    console.error('Error generating quick code:', error);
    return res.error('INTERNAL_ERROR', 'Failed to generate quick code', 500);
  }
});

export default router;
