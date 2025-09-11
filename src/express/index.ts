import express from 'express';
import cors from 'cors';
import fs from 'fs';

import playeraddresses from './playeraddresses';
import enderstorage from './enderstorage';
import shopsync from './shopsync';
import knownaddresses from './knownaddresses';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

const PORT = process.env.PORT ?? 3000;

const app = express();

app.use(
  cors({
    origin: [`http://localhost:5173`, 'https://www.kromer.club', 'https://krawlet.kromer.club'],
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
      name: packageJson.name,
      version: packageJson.version,
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
