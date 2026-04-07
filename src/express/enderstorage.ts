import { Router, Request, Response, json } from 'express';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { authenticateApiKeyTier } from '../lib/authenticateApiKeyTier';
import { EnderStoragePayload, isEnderStoragePayload } from '../lib/types';

const router = Router();

const saveJsonToFile = (data: EnderStoragePayload) => {
  writeFileSync('enderstorage.json', JSON.stringify(data, null, 2));
};

const loadJsonFromFile = (): EnderStoragePayload | null => {
  if (existsSync('enderstorage.json')) {
    const parsed: unknown = JSON.parse(readFileSync('enderstorage.json', 'utf8'));
    if (isEnderStoragePayload(parsed)) {
      return parsed;
    }
  }
  return null;
};

let lastJsonData: EnderStoragePayload | null = loadJsonFromFile();

router.post(
  '/',
  authenticateApiKeyTier('enderstorage', 'internal'),
  json(),
  (req: Request, res: Response) => {
    try {
      if (!isEnderStoragePayload(req.body)) {
        return res.status(400).json({
          ok: false,
          error: 'Invalid ender storage payload',
        });
      }

      // Store the JSON data
      lastJsonData = req.body;
      saveJsonToFile(lastJsonData);

      res.status(200).json({
        ok: true,
        message: 'JSON data stored successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
      res.status(400).json({
        ok: false,
        error: 'Invalid JSON data',
      });
    }
  },
);

router.get('/', (req: Request, res: Response) => {
  if (lastJsonData === null) {
    return res.status(404).json({
      ok: false,
      error: 'No JSON data has been stored yet',
    });
  }

  res.status(200).json({
    ok: true,
    data: lastJsonData,
    retrievedAt: Date.now(),
  });
});

export default router;
