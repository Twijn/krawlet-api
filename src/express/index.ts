import express from 'express';
import cors from 'cors';

import playeraddresses from './playeraddresses';
import enderstorage from './enderstorage';
import shopsync from './shopsync';
import knownaddresses from './knownaddresses';
import turtles from './turtles';
import { getPackageName, getPackageVersion } from '../lib/packageData';

// Import V1 router
import v1Router from './v1';
import { rateLimiterMiddleware } from './v1/middleware/rateLimiter';
import { optionalApiKeyAuth } from './v1/middleware/apiKeyAuth';
import { requestIdMiddleware } from './v1/middleware/requestId';
import { responseFormatterMiddleware } from './v1/middleware/responseFormatter';

const PORT = process.env.PORT ?? 3000;

const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  }),
);

// Apply rate limiting to ALL routes (legacy and V1)
app.use(requestIdMiddleware);
app.use(responseFormatterMiddleware);
app.use(optionalApiKeyAuth);
app.use(rateLimiterMiddleware);

// Mount V1 API
app.use('/v1', v1Router);

// Legacy endpoints (keep unchanged)
app.use('/playeraddresses', playeraddresses);
app.use('/enderstorage', enderstorage);
app.use('/shopsync', shopsync);
app.use('/knownaddresses', knownaddresses);
app.use('/turtles', turtles);

app.get('/', (req, res) => {
  res.json({
    ok: true,
    data: {
      name: getPackageName(),
      version: getPackageVersion(),
      apiVersion: 'v1',
      endpoints: {
        legacy: ['/playeraddresses', '/enderstorage', '/shopsync', '/knownaddresses', '/turtles'],
        v1: '/v1',
      },
    },
  });
});

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Endpoint not found',
  });
});

app.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`);
  console.log(`V1 API available at http://localhost:${PORT}/v1`);
});
