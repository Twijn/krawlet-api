import { Router } from 'express';
import playerManager from '../../lib/managers/playerManager';

const router = Router();

router.get('/:addresses', (req, res) => {
  const addresses = req.params.addresses.split(',');
  return res.json({
    ok: true,
    data: playerManager.getPlayersFromAddresses(addresses),
  });
});

export default router;
