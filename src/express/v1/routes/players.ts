import { Router, Request, Response } from 'express';
import playerManager from '../../../lib/managers/playerManager';
import {
  EstorageEntity,
  EstorageEntityLink,
  findEntityByLookup,
  VALID_COLORS,
} from '../../../lib/models';
import authenticateApiKeyTier from '../../../lib/authenticateApiKeyTier';

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

// POST /v1/players/:mcUuid/link - Link player UUID to an ender storage entity
router.post(
  '/:mcUuid/link',
  authenticateApiKeyTier('internal'),
  async (req: Request, res: Response) => {
    const { mcUuid } = req.params;
    const { colors } = req.body;

    try {
      const player = await playerManager.getPlayerFromUUID(mcUuid);
      if (!player) {
        return res.error('NOT_FOUND', 'Player not found', 404);
      }

      const existingLink = await EstorageEntityLink.findOne({
        where: {
          linkValue: mcUuid,
        },
      });

      if (existingLink) {
        return res.error(
          'CONFLICT',
          'You already have an ender storage linked to your player UUID. Only one link per player is allowed.',
          409,
        );
      }

      let entity = await findEntityByLookup(player.minecraftName);

      if (!entity) {
        const hasValidColors =
          Array.isArray(colors) &&
          colors.length === 3 &&
          colors.every((c) => typeof c === 'number' && VALID_COLORS.includes(c));

        if (!hasValidColors) {
          return res.error(
            'BAD_REQUEST',
            'Target entity not found. Provide colors=[a,b,c] with valid EnderStorage colors to create it.',
            400,
          );
        }

        entity = await EstorageEntity.create({
          name: player.minecraftName,
          entityType: 'player',
          colorA: colors[0],
          colorB: colors[1],
          colorC: colors[2],
          active: true,
        });
      }

      await EstorageEntityLink.upsert({
        entityId: entity.id,
        linkType: 'player_uuid',
        linkValue: mcUuid,
        linkName: player.minecraftName,
        isPrimary: true,
      });

      return res.success({
        player,
        linkedEntity: {
          id: entity.id,
          name: entity.name,
          type: entity.entityType,
        },
      });
    } catch (error) {
      console.error('Error linking player to entity:', error);
      return res.error('INTERNAL_ERROR', 'Failed to link player to entity', 500);
    }
  },
);

export default router;
