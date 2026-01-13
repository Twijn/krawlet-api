import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';
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

// Load OpenAPI spec
const openapiPath = join(__dirname, '../../../openapi.yaml');
const openapiFile = readFileSync(openapiPath, 'utf8');
const openapiSpec = YAML.parse(openapiFile);

// Serve OpenAPI docs at /v1/docs (without rate limiting or auth)
router.use('/docs', swaggerUi.serve);
router.get(
  '/docs',
  swaggerUi.setup(openapiSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
      .swagger-ui .info .title { font-size: 2.5rem; }
      .swagger-ui .scheme-container { background: #fafafa; padding: 1rem; border-radius: 4px; }
    `,
    customSiteTitle: 'Krawlet API Documentation',
    customfavIcon: '/favicon.ico',
  }),
);

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
    documentation: '/v1/docs',
    github: 'https://github.com/Twijn/krawlet-api',
  });
});

export default router;
