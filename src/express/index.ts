import express from 'express';
import cors from 'cors';

import playeraddresses from './playeraddresses';
import enderstorage from './enderstorage';
import shopsync from './shopsync';
import knownaddresses from './knownaddresses';
import turtles from './turtles';
import { getPackageName, getPackageVersion } from '../lib/packageData';

const PORT = process.env.PORT ?? 3000;

const app = express();

// Middleware to track elapsed time
app.use((req, res, next) => {
  const startTime = Date.now();

  // Override res.json to include elapsed time
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const elapsed = Date.now() - startTime;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      body.elapsed = elapsed;
    }
    return originalJson(body);
  };

  next();
});

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  }),
);

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
});
