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

app.use(cors());

// Mount docs at root (krawlet.cc/)
app.use('/', docsRouter);

// Legacy endpoints at root level (for backward compatibility)
app.use('/playeraddresses', playeraddresses);
app.use('/enderstorage', enderstorage);
app.use('/shopsync', shopsync);
app.use('/knownaddresses', knownaddresses);
app.use('/turtles', turtles);

// Create /api router for all API endpoints (api.krawlet.cc/)
const apiRouter = express.Router();

// API info endpoint at /api root
apiRouter.get('/', (req, res) => {
  res.json({
    ok: true,
    data: {
      name: getPackageName(),
      version: getPackageVersion(),
      apiVersions: ['v1'],
      documentation: 'https://krawlet.cc',
      endpoints: {
        v1: '/v1',
        legacy: ['/playeraddresses', '/enderstorage', '/shopsync', '/knownaddresses', '/turtles'],
      },
    },
  });
});

// Mount V1 API
apiRouter.use('/v1', v1Router);

// Legacy endpoints under /api
apiRouter.use('/playeraddresses', playeraddresses);
apiRouter.use('/enderstorage', enderstorage);
apiRouter.use('/shopsync', shopsync);
apiRouter.use('/knownaddresses', knownaddresses);
apiRouter.use('/turtles', turtles);

// Mount the /api router
app.use('/api', apiRouter);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Endpoint not found',
  });
});

app.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`);
  console.log(`Documentation available at http://localhost:${PORT}/`);
  console.log(`V1 API available at http://localhost:${PORT}/api/v1`);
});
