import { Router, Request, Response, json } from 'express';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import authenticate from '../lib/authenticate';

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

router.post(
  '/',
  authenticate(process.env.ESTORAGE_API_TOKEN!),
  json(),
  (req: Request, res: Response) => {
    try {
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
