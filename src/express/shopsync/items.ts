import { Router } from 'express';
import { getListings } from '#lib/models';
import { createLogger } from '#lib/logger';

const log = createLogger('ShopSync');
const router = Router();

router.get('/', async (req, res) => {
  try {
    res.json({
      ok: true,
      data: (await getListings()).map((item) => item.raw()),
    });
  } catch (err) {
    log.error(err);
    res.status(500).json({
      ok: false,
      error: 'Internal server error',
    });
  }
});

export default router;
