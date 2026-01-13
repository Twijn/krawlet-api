import { Router, Request, Response, json } from 'express';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import authenticate from '../../../lib/authenticate';

const router = Router();

const saveJsonToFile = (data: unknown) => {
  writeFileSync('enderstorage.json', JSON.stringify(data, null, 2));
};

const loadJsonFromFile = (): unknown => {
  if (existsSync('enderstorage.json')) {
    return JSON.parse(readFileSync('enderstorage.json', 'utf8'));
  }
  return null;
};

let lastJsonData: unknown = loadJsonFromFile();

// POST /v1/storage - Store ender storage data (authenticated)
router.post(
  '/',
  authenticate(process.env.ESTORAGE_API_TOKEN!),
  json(),
  (req: Request, res: Response) => {
    try {
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
