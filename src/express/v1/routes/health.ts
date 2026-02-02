import { Router } from 'express';
import { sequelize } from '../../../lib/models/database';
import { getPackageName, getPackageVersion } from '../../../lib/packageData';
import haTransactions from '../../../kromerWs';
import { getChatStatus } from '../../../chat';
import { getDiscordStatus } from '../../../discord';

const router = Router();

// Basic health check
router.get('/', async (req, res) => {
  try {
    // Check database connection
    await sequelize.authenticate();

    // Get service statuses
    const kromerStatus = haTransactions.getStatus();
    const chatStatus = getChatStatus();
    const discordStatus = getDiscordStatus();

    return res.success({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: getPackageVersion(),
      name: getPackageName(),
      services: {
        kromerWs: {
          status: kromerStatus.status,
          ...(kromerStatus.lastError && { lastError: kromerStatus.lastError }),
        },
        chatbox: {
          status: chatStatus.status,
          ...(chatStatus.lastError && { lastError: chatStatus.lastError }),
        },
        discord: {
          status: discordStatus.status,
          ...(discordStatus.lastError && { lastError: discordStatus.lastError }),
        },
      },
    });
  } catch {
    return res.error('HEALTH_CHECK_FAILED', 'Service is unhealthy', 503, {
      database: 'disconnected',
    });
  }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  const checks: Record<string, boolean> = {
    database: false,
    memory: false,
    kromerWs: false,
    chatbox: false,
    discord: false,
  };

  try {
    // Database check
    await sequelize.authenticate();
    checks.database = true;
  } catch {
    // Database failed
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  checks.memory = heapUsedMB < heapTotalMB * 0.9; // Less than 90% used

  // Service status checks
  const kromerStatus = haTransactions.getStatus();
  const chatStatus = getChatStatus();
  const discordStatus = getDiscordStatus();

  checks.kromerWs = kromerStatus.status === 'connected';
  checks.chatbox = chatStatus.status === 'connected';
  checks.discord = discordStatus.status === 'connected';

  const allHealthy = Object.values(checks).every((check) => check === true);

  return res.success(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      details: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: getPackageVersion(),
        name: getPackageName(),
        memory: {
          heapUsed: `${heapUsedMB}MB`,
          heapTotal: `${heapTotalMB}MB`,
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        },
        node: process.version,
        platform: process.platform,
      },
      services: {
        kromerWs: {
          status: kromerStatus.status,
          ...(kromerStatus.lastError && { lastError: kromerStatus.lastError }),
          ...(kromerStatus.lastConnectedAt && {
            lastConnectedAt: kromerStatus.lastConnectedAt.toISOString(),
          }),
          lastTransactionId: kromerStatus.lastTransactionId,
        },
        chatbox: {
          status: chatStatus.status,
          ...(chatStatus.lastError && { lastError: chatStatus.lastError }),
          owner: chatStatus.owner,
          playerCount: chatStatus.playerCount,
        },
        discord: {
          status: discordStatus.status,
          ...(discordStatus.lastError && { lastError: discordStatus.lastError }),
          username: discordStatus.username,
          commandCount: discordStatus.commandCount,
        },
      },
    },
    allHealthy ? 200 : 503,
  );
});

export default router;
