import { Router } from 'express';
import { getListings } from '../../../lib/models';

const router = Router();

// GET /v1/items - Get all items/listings
router.get('/', async (req, res) => {
  try {
    const items = await getListings();
    return res.success(items.map((item) => item.raw()));
  } catch (error) {
    console.error('Error fetching items:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch items', 500);
  }
});

export default router;
