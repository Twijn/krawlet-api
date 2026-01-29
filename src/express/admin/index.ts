import { Router, Request, Response, NextFunction } from 'express';
import { ApiKey } from '../../lib/models/apikey.model';
import { RequestLog } from '../../lib/models/requestlog.model';
import { Op } from 'sequelize';
import { sequelize } from '../../lib/models/database';
import path from 'path';
import express from 'express';

const router = Router();

// Parse JSON bodies for POST requests
router.use(express.json());

// ============================================
// IP Allowlist Middleware
// ============================================
// Set ADMIN_ALLOWED_IPS in .env as comma-separated list: "127.0.0.1,192.168.1.100"
// Leave empty or unset to allow all IPs
const getClientIp = (req: Request): string => {
  // Support reverse proxy headers
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const ipAllowlist = (req: Request, res: Response, next: NextFunction) => {
  const allowedIps = process.env.ADMIN_ALLOWED_IPS;

  // If no allowlist configured, allow all
  if (!allowedIps || allowedIps.trim() === '') {
    return next();
  }

  const allowedList = allowedIps.split(',').map((ip) => ip.trim());
  const clientIp = getClientIp(req);

  // Normalize IPv6 localhost to IPv4
  const normalizedIp = clientIp === '::1' ? '127.0.0.1' : clientIp;

  if (allowedList.includes(normalizedIp) || allowedList.includes(clientIp)) {
    return next();
  }

  console.warn(`Admin access denied for IP: ${clientIp}`);
  return res.status(403).json({
    ok: false,
    error: 'Access denied: IP not allowed',
  });
};

// ============================================
// Rate Limiting Middleware
// ============================================
// Simple in-memory rate limiter: 30 requests per minute per IP
const rateLimitWindowMs = 60 * 1000; // 1 minute
const rateLimitMaxRequests = 30;
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, rateLimitWindowMs);

const rateLimit = (req: Request, res: Response, next: NextFunction) => {
  const clientIp = getClientIp(req);
  const now = Date.now();

  let record = rateLimitStore.get(clientIp);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + rateLimitWindowMs };
    rateLimitStore.set(clientIp, record);
    return next();
  }

  record.count++;

  if (record.count > rateLimitMaxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter.toString());
    return res.status(429).json({
      ok: false,
      error: 'Too many requests. Please try again later.',
      retryAfter,
    });
  }

  return next();
};

// Apply IP allowlist and rate limiting to all admin routes
router.use(ipAllowlist);
router.use(rateLimit);

// Serve static files (CSS, JS)
router.use('/static', express.static(path.join(__dirname, 'static')));

// Simple authentication middleware for admin dashboard
const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(503).json({
      ok: false,
      error: 'Admin dashboard not configured. Set ADMIN_PASSWORD in .env',
    });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="Admin Dashboard"');
    return res.status(401).json({
      ok: false,
      error: 'Authentication required',
    });
  }

  const token = authHeader.substring(7);

  if (token !== adminPassword) {
    return res.status(401).json({
      ok: false,
      error: 'Invalid credentials',
    });
  }

  next();
};

// Serve the admin dashboard HTML
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// API endpoint: Get statistics
router.get('/api/stats', adminAuth, async (req, res) => {
  try {
    const [statsResult] = await sequelize.query(`
      SELECT
        (SELECT COUNT(*) FROM api_keys) as totalKeys,
        (SELECT COUNT(*) FROM api_keys WHERE isActive = 1) as activeKeys,
        (SELECT COALESCE(SUM(requestCount), 0) FROM api_keys) as totalRequests,
        (SELECT COUNT(*) FROM request_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as requests24h,
        (SELECT COUNT(*) FROM request_logs WHERE was_blocked = 1) as blockedRequests,
        (SELECT COUNT(*) FROM request_logs) as totalLogs
    `);

    const stats = statsResult as any[];

    const [mostActive] = await ApiKey.findAll({
      order: [['requestCount', 'DESC']],
      limit: 1,
    });

    const blockRate =
      stats[0].totalLogs > 0 ? (stats[0].blockedRequests / stats[0].totalLogs) * 100 : 0;

    res.json({
      totalKeys: stats[0].totalKeys,
      activeKeys: stats[0].activeKeys,
      totalRequests: stats[0].totalRequests,
      requests24h: stats[0].requests24h,
      blockedRequests: stats[0].blockedRequests,
      blockRate,
      mostActiveKey: mostActive?.name || null,
      mostActiveCount: mostActive?.requestCount || 0,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch statistics' });
  }
});

// API endpoint: Get all API keys with filters
router.get('/api/keys', adminAuth, async (req, res) => {
  try {
    const { tier, active, search } = req.query;
    const where: any = {};

    if (tier) where.tier = tier;
    if (active !== undefined) where.isActive = active === 'true';
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const keys = await ApiKey.findAll({
      where,
      order: [['requestCount', 'DESC']],
      attributes: [
        'id',
        'name',
        'email',
        'tier',
        'rateLimit',
        'requestCount',
        'lastUsedAt',
        'isActive',
        'createdAt',
      ],
    });

    res.json(keys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch API keys' });
  }
});

// API endpoint: Get single API key details
router.get('/api/keys/:id', adminAuth, async (req, res) => {
  try {
    const key = await ApiKey.findByPk(req.params.id, {
      attributes: [
        'id',
        'name',
        'email',
        'tier',
        'rateLimit',
        'requestCount',
        'lastUsedAt',
        'isActive',
        'createdAt',
        'minecraftName',
        'minecraftUuid',
      ],
    });

    if (!key) {
      return res.status(404).json({ ok: false, error: 'API key not found' });
    }

    res.json(key);
  } catch (error) {
    console.error('Error fetching API key:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch API key' });
  }
});

// API endpoint: Get API key request logs
router.get('/api/keys/:id/logs', adminAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

    const logs = await RequestLog.findAll({
      where: { apiKeyId: req.params.id },
      order: [['createdAt', 'DESC']],
      limit,
      attributes: [
        'requestId',
        'method',
        'path',
        'ipAddress',
        'wasBlocked',
        'blockReason',
        'responseStatus',
        'createdAt',
      ],
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching key logs:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch key logs' });
  }
});

// API endpoint: Update API key
router.patch('/api/keys/:id', adminAuth, async (req, res) => {
  try {
    const key = await ApiKey.findByPk(req.params.id);

    if (!key) {
      return res.status(404).json({ ok: false, error: 'API key not found' });
    }

    const { isActive, tier, rateLimit } = req.body;

    if (isActive !== undefined) key.isActive = isActive;
    if (tier) key.tier = tier;
    if (rateLimit) key.rateLimit = rateLimit;

    await key.save();

    res.json({ ok: true, message: 'API key updated successfully' });
  } catch (error) {
    console.error('Error updating API key:', error);
    res.status(500).json({ ok: false, error: 'Failed to update API key' });
  }
});

// API endpoint: Delete API key
router.delete('/api/keys/:id', adminAuth, async (req, res) => {
  try {
    const key = await ApiKey.findByPk(req.params.id);

    if (!key) {
      return res.status(404).json({ ok: false, error: 'API key not found' });
    }

    await key.destroy();

    res.json({ ok: true, message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ ok: false, error: 'Failed to delete API key' });
  }
});

// API endpoint: Create new API key
router.post('/api/keys', adminAuth, async (req, res) => {
  try {
    const { name, email, tier } = req.body;

    if (!name) {
      return res.status(400).json({ ok: false, error: 'Name is required' });
    }

    // Generate the key and hash it
    const rawKey = ApiKey.generateKey();
    const hashedKey = ApiKey.hashKey(rawKey);

    // Determine rate limit based on tier
    const tierValue = tier || 'free';
    let rateLimit = 1000; // free default
    if (tierValue === 'premium') rateLimit = 10000;

    // Create the API key
    const apiKey = await ApiKey.create({
      key: hashedKey,
      name,
      email: email || null,
      tier: tierValue,
      rateLimit,
      isActive: true,
      requestCount: 0,
    });

    // Return the raw key (only time it will be shown)
    res.json({
      id: apiKey.id,
      key: rawKey,
      name: apiKey.name,
      email: apiKey.email,
      tier: apiKey.tier,
      rateLimit: apiKey.rateLimit,
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ ok: false, error: 'Failed to create API key' });
  }
});

// API endpoint: Get request logs with pagination
router.get('/api/logs', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const { blocked, search } = req.query;

    const where: any = {};
    if (blocked !== undefined) where.wasBlocked = blocked === 'true';
    if (search) {
      where[Op.or] = [
        { ipAddress: { [Op.like]: `%${search}%` } },
        { path: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await RequestLog.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: [
        'requestId',
        'method',
        'path',
        'ipAddress',
        'tier',
        'wasBlocked',
        'blockReason',
        'responseStatus',
        'rateLimitCount',
        'rateLimitLimit',
        'rateLimitRemaining',
        'createdAt',
      ],
    });

    res.json({
      logs: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error('Error fetching request logs:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch request logs' });
  }
});

// API endpoint: Get request trends for chart
router.get('/api/charts/trends', adminAuth, async (req, res) => {
  try {
    const [results] = await sequelize.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM request_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    const data = results as any[];
    const labels = data.map((row) => {
      const date = new Date(row.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const counts = data.map((row) => row.count);

    res.json({
      labels,
      data: counts,
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch trends' });
  }
});

// API endpoint: Get tier distribution for chart
router.get('/api/charts/tiers', adminAuth, async (req, res) => {
  try {
    const [results] = await sequelize.query(`
      SELECT
        tier,
        COUNT(*) as count
      FROM request_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY tier
    `);

    const data = results as any[];
    const labels = data.map((row) => row.tier.charAt(0).toUpperCase() + row.tier.slice(1));
    const counts = data.map((row) => row.count);

    res.json({
      labels,
      data: counts,
    });
  } catch (error) {
    console.error('Error fetching tier data:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch tier data' });
  }
});

// API endpoint: Get hits by path for chart
router.get('/api/charts/paths', adminAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const [results] = await sequelize.query(
      `
      SELECT
        path,
        COUNT(*) as count
      FROM request_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY path
      ORDER BY count DESC
      LIMIT :limit
    `,
      {
        replacements: { limit },
      },
    );

    const data = results as any[];

    // Shorten long paths for display
    const labels = data.map((row) => {
      const path = row.path;
      if (path.length > 30) {
        return path.substring(0, 27) + '...';
      }
      return path;
    });
    const counts = data.map((row) => row.count);
    const fullPaths = data.map((row) => row.path);

    res.json({
      labels,
      data: counts,
      fullPaths,
    });
  } catch (error) {
    console.error('Error fetching path data:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch path data' });
  }
});

// API endpoint: Get requests by IP address for chart
router.get('/api/charts/ips', adminAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const [results] = await sequelize.query(
      `
      SELECT
        ip_address,
        COUNT(*) as count
      FROM request_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY ip_address
      ORDER BY count DESC
      LIMIT :limit
    `,
      {
        replacements: { limit },
      },
    );

    const data = results as any[];
    const labels = data.map((row) => row.ip_address);
    const counts = data.map((row) => row.count);

    res.json({
      labels,
      data: counts,
    });
  } catch (error) {
    console.error('Error fetching IP data:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch IP data' });
  }
});

// API endpoint: Get path breakdown for a specific IP address
router.get('/api/charts/ips/:ip/paths', adminAuth, async (req, res) => {
  try {
    const ip = req.params.ip;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const [results] = await sequelize.query(
      `
      SELECT
        path,
        COUNT(*) as count
      FROM request_logs
      WHERE ip_address = :ip
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY path
      ORDER BY count DESC
      LIMIT :limit
    `,
      {
        replacements: { ip, limit },
      },
    );

    const data = results as any[];

    res.json({
      ip,
      paths: data.map((row) => ({
        path: row.path,
        count: row.count,
      })),
    });
  } catch (error) {
    console.error('Error fetching IP path data:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch IP path data' });
  }
});

// API endpoint: Get requests by user agent for chart
router.get('/api/charts/useragents', adminAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const [results] = await sequelize.query(
      `
      SELECT
        COALESCE(user_agent, 'Unknown') as user_agent,
        COUNT(*) as count
      FROM request_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY user_agent
      ORDER BY count DESC
      LIMIT :limit
    `,
      {
        replacements: { limit },
      },
    );

    const data = results as any[];

    // Shorten long user agents for display
    const labels = data.map((row) => {
      const ua = row.user_agent || 'Unknown';
      if (ua.length > 40) {
        return ua.substring(0, 37) + '...';
      }
      return ua;
    });
    const counts = data.map((row) => row.count);
    const fullUserAgents = data.map((row) => row.user_agent || 'Unknown');

    res.json({
      labels,
      data: counts,
      fullUserAgents,
    });
  } catch (error) {
    console.error('Error fetching user agent data:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch user agent data' });
  }
});

// API endpoint: Get details for a specific IP (paths and user agents)
router.get('/api/charts/ips/:ip/details', adminAuth, async (req, res) => {
  try {
    const ip = req.params.ip;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const [pathResults] = await sequelize.query(
      `
      SELECT path, COUNT(*) as count
      FROM request_logs
      WHERE ip_address = :ip AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY path
      ORDER BY count DESC
      LIMIT :limit
    `,
      { replacements: { ip, limit } },
    );

    const [uaResults] = await sequelize.query(
      `
      SELECT COALESCE(user_agent, 'Unknown') as user_agent, COUNT(*) as count
      FROM request_logs
      WHERE ip_address = :ip AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY user_agent
      ORDER BY count DESC
      LIMIT :limit
    `,
      { replacements: { ip, limit } },
    );

    res.json({
      ip,
      paths: (pathResults as any[]).map((row) => ({ path: row.path, count: row.count })),
      userAgents: (uaResults as any[]).map((row) => ({
        userAgent: row.user_agent,
        count: row.count,
      })),
    });
  } catch (error) {
    console.error('Error fetching IP details:', error);
    res.status(500).json({ ok: false, error: 'Failed to fetch IP details' });
  }
});

export default router;
