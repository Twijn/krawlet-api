import { Router } from 'express';
import { getKnownAddresses } from '../../../lib/models';
import { createLogger } from '../../../lib/logger';

const log = createLogger('API');
const router = Router();

// GET /v1/addresses - Get all known addresses
router.get('/', (req, res) => {
  try {
    const addresses = getKnownAddresses();
    return res.success(addresses);
  } catch (error) {
    log.error('Error fetching known addresses:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch known addresses', 500);
  }
});

export default router;
