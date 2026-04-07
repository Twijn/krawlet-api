import { Router, Request, Response, json } from 'express';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { authenticateApiKeyTier } from '../../../lib/authenticateApiKeyTier';
import { EnderStoragePayload, isEnderStoragePayload } from '../../../lib/types';

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

// POST /v1/storage - Store ender storage data (authenticated - enderstorage or internal tier keys only)
router.post(
  '/',
  authenticateApiKeyTier('enderstorage', 'internal'),
  json(),
  (req: Request, res: Response) => {
    try {
      if (!isEnderStoragePayload(req.body)) {
        return res.error('BAD_REQUEST', 'Invalid ender storage payload', 400);
      }

      // Store the JSON data
      lastJsonData = req.body;
      saveJsonToFile(lastJsonData);

      return res.success({
        message: 'Ender storage data stored successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error storing ender storage data:', error);
      return res.error('BAD_REQUEST', 'Invalid JSON data', 400);
    }
  },
);

// GET /v1/storage - Retrieve ender storage data
router.get('/', (req: Request, res: Response) => {
  if (lastJsonData === null) {
    return res.error('NOT_FOUND', 'No ender storage data has been stored yet', 404);
  }

  return res.success({
    data: lastJsonData,
    retrievedAt: new Date().toISOString(),
  });
});

export default router;
