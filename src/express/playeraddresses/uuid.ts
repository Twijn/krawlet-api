import { Router } from 'express';
import playerManager from '../../lib/managers/playerManager';

const router = Router();

router.get('/:uuids', (req, res) => {
  const uuids = req.params.uuids.split(',');
  return res.json({
    ok: true,
    data: playerManager.getPlayersFromUUIDs(uuids),
  });
});

export default router;
