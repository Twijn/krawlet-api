import express from 'express';
import cors from 'cors';

import playeraddresses from './playeraddresses';
import enderstorage from './enderstorage';
import shopsync from './shopsync';
import knownaddresses from './knownaddresses';
import { getPackageName, getPackageVersion } from '../lib/packageData';

const PORT = process.env.PORT ?? 3000;

const app = express();
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
