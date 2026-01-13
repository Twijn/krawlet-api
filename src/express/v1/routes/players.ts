import { Router, Request, Response } from 'express';
import playerManager from '../../../lib/managers/playerManager';

const router = Router();

// GET /v1/players - Get players by query params
router.get('/', (req: Request, res: Response) => {
  const { addresses, names, uuids } = req.query;

  try {
    let players;

    if (addresses) {
      const addressList = (addresses as string).split(',');
      players = playerManager.getPlayersFromAddresses(addressList);
    } else if (names) {
      const nameList = (names as string).split(',');
      players = playerManager.getPlayersFromNames(nameList);
    } else if (uuids) {
      const uuidList = (uuids as string).split(',');
      players = playerManager.getPlayersFromUUIDs(uuidList);
    } else {
      // Get all players
      players = playerManager.getAll();
    }

    return res.success(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    return res.error('INTERNAL_ERROR', 'Failed to fetch players', 500);
  }
});

export default router;
