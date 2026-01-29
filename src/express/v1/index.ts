import { Router } from 'express';
import express from 'express';
import { requestIdMiddleware } from './middleware/requestId';
import { responseFormatterMiddleware } from './middleware/responseFormatter';
import { optionalApiKeyAuth } from './middleware/apiKeyAuth';
import { rateLimiterMiddleware } from './middleware/rateLimiter';

import playersRouter from './routes/players';
import shopsRouter from './routes/shops';
import itemsRouter from './routes/items';
import addressesRouter from './routes/addresses';
import storageRouter from './routes/storage';
import reportsRouter from './routes/reports';
import healthRouter from './routes/health';
import apikeyRouter from './routes/apikey';

const router = Router();

// Parse JSON request bodies
router.use(express.json());

// Apply V1 middleware in order
router.use(requestIdMiddleware);
router.use(responseFormatterMiddleware);
router.use(optionalApiKeyAuth);
router.use(rateLimiterMiddleware);

// Mount V1 routes
router.use('/players', playersRouter);
router.use('/shops', shopsRouter);
router.use('/items', itemsRouter);
router.use('/addresses', addressesRouter);
router.use('/storage', storageRouter);
router.use('/reports', reportsRouter);
router.use('/health', healthRouter);
router.use('/apikey', apikeyRouter);

// V1 root endpoint
router.get('/', (req, res) => {
  res.success({
    version: 'v1',
    endpoints: [
      '/v1/players',
      '/v1/shops',
      '/v1/items',
      '/v1/addresses',
      '/v1/storage',
      '/v1/reports',
      '/v1/health',
      '/v1/apikey',
      '/v1/apikey/quickcode/generate',
      '/v1/apikey/quickcode/redeem',
    ],
    documentation: 'https://krawlet.cc/docs/v1',
    github: 'https://github.com/Twijn/krawlet-api',
  });
});

export default router;
