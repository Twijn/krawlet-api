import { Router } from 'express';
import { sequelize } from '../../../lib/models/database';
import { getPackageName, getPackageVersion } from '../../../lib/packageData';

const router = Router();

// Basic health check
router.get('/', async (req, res) => {
  try {
    // Check database connection
    await sequelize.authenticate();

    return res.success({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: getPackageVersion(),
      name: getPackageName(),
    });
  } catch {
    return res.error('HEALTH_CHECK_FAILED', 'Service is unhealthy', 503, {
      database: 'disconnected',
    });
  }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  const checks = {
    database: false,
    memory: false,
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
    },
    allHealthy ? 200 : 503,
  );
});

export default router;
