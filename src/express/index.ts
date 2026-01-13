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
import docsRouter from './docs';

const PORT = process.env.PORT ?? 3000;

const app = express();

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  }),
);

// Mount docs
app.use('/docs', docsRouter);

// Mount V1 API
app.use('/api/v1', v1Router);

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
      apiVersions: ['/api/v1'],
      documentation: '/docs',
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
