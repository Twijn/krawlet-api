import { Router } from 'express';
import { getListings } from '../../../lib/models';
import { createLogger } from '../../../lib/logger';

const log = createLogger('API');
const router = Router();

// GET /v1/items - Get all items/listings
router.get('/', async (req, res) => {
  try {
    const items = await getListings();
    return res.success(items.map((item) => item.raw()));
  } catch (error) {
    log.error('Error fetching items:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch items', 500);
  }
});

export default router;
