import { Router } from 'express';
import { requestIdMiddleware } from './middleware/requestId';
import { responseFormatterMiddleware } from './middleware/responseFormatter';
import { optionalApiKeyAuth } from './middleware/apiKeyAuth';
import { rateLimiterMiddleware } from './middleware/rateLimiter';

import playersRouter from './routes/players';
import shopsRouter from './routes/shops';
import itemsRouter from './routes/items';
import turtlesRouter from './routes/turtles';
import addressesRouter from './routes/addresses';
import storageRouter from './routes/storage';
import reportsRouter from './routes/reports';
import healthRouter from './routes/health';

const router = Router();

// Apply V1 middleware in order
router.use(requestIdMiddleware);
router.use(responseFormatterMiddleware);
router.use(optionalApiKeyAuth);
router.use(rateLimiterMiddleware);

// Mount V1 routes
router.use('/players', playersRouter);
router.use('/shops', shopsRouter);
router.use('/items', itemsRouter);
router.use('/turtles', turtlesRouter);
router.use('/addresses', addressesRouter);
router.use('/storage', storageRouter);
router.use('/reports', reportsRouter);
router.use('/health', healthRouter);

// V1 root endpoint
router.get('/', (req, res) => {
  res.success({
    version: 'v1',
    endpoints: [
      '/v1/players',
      '/v1/shops',
      '/v1/items',
      '/v1/turtles',
      '/v1/addresses',
      '/v1/storage',
      '/v1/reports',
      '/v1/health',
    ],
    documentation: 'https://github.com/Twijn/krawlet-api',
  });
});

export default router;
