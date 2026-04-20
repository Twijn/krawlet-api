import { Router, json } from 'express';
import authenticateApiKeyTier from '../../../lib/authenticateApiKeyTier';
import {
  EstorageEntity,
  EstorageEntityLink,
  findEntityById,
  findEntityByLookup,
  findEntityByPlayerUuid,
  VALID_COLORS,
} from '../../../lib/models';
import { RequestWithRateLimit } from '../types/request';
import { queueTransferByEntities } from '../../ws';
import { WorkerLimitExceededError } from '../../ws/workerActivity';

const router = Router();

async function resolveRequesterEntity(request: RequestWithRateLimit) {
  if (!request.apiKey) {
    return { entity: null, error: 'API key required to access this endpoint' };
  }

  if (request.apiKey.estorageEntityId) {
    const linkedEntity = await findEntityById(request.apiKey.estorageEntityId);
    if (linkedEntity) {
      return { entity: linkedEntity, error: null };
    }
  }

  if (request.apiKey.mcUuid) {
    const playerEntity = await findEntityByPlayerUuid(request.apiKey.mcUuid);
    if (playerEntity) {
      return { entity: playerEntity, error: null };
    }
  }

  return {
    entity: null,
    error:
      'API key is not linked to an ender storage entity. Ask an admin to provision this key with an entity link or attach mcUuid to a linked player entity.',
  };
}

router.post(
  '/public-storage',
  authenticateApiKeyTier('free', 'premium'),
  json(),
  async (req, res) => {
    const request = req as RequestWithRateLimit;

    if (!request.apiKey) {
      return res.error('UNAUTHORIZED', 'API key required to access this endpoint', 401);
    }

    const { itemName, itemNbt, quantity, timeout, source, colors } = req.body;

    if (typeof itemName !== 'string') {
      return res.error('BAD_REQUEST', 'itemName must be a string', 400);
    }

    if (itemNbt !== undefined && typeof itemNbt !== 'string') {
      return res.error('BAD_REQUEST', 'itemNbt must be a string when provided', 400);
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return res.error('BAD_REQUEST', 'quantity must be a positive number', 400);
    }

    if (quantity > 1024) {
      return res.error('BAD_REQUEST', 'quantity must be 1024 or less', 400);
    }

    if (timeout !== undefined && (typeof timeout !== 'number' || timeout < 0.1 || timeout > 30)) {
      return res.error('BAD_REQUEST', 'timeout must be a number between 0.1 and 30 seconds', 400);
    }

    try {
      const resolved = await resolveRequesterEntity(request);
      const requesterEntity = resolved.entity;
      if (!requesterEntity) {
        return res.error(
          'BAD_REQUEST',
          resolved.error ?? 'Unable to resolve requester entity',
          400,
        );
      }

      let publicEntity = null;

      if (typeof source === 'string' && source.trim().length > 0) {
        publicEntity = await findEntityByLookup(source);
      }

      let publicAlias: string | null = null;

      if (!publicEntity) {
        const hasValidColors =
          Array.isArray(colors) &&
          colors.length === 3 &&
          colors.every((c: unknown) => typeof c === 'number' && VALID_COLORS.includes(c));

        if (!hasValidColors) {
          return res.error(
            'BAD_REQUEST',
            'Provide either source (existing entity id/name/link) or colors=[a,b,c] for public storage.',
            400,
          );
        }

        const [a, b, c] = colors as [number, number, number];
        publicAlias = `public:${a},${b},${c}`;

        publicEntity = await findEntityByLookup(publicAlias);

        if (!publicEntity) {
          publicEntity = await EstorageEntity.create({
            name: publicAlias,
            entityType: 'service',
            colorA: a,
            colorB: b,
            colorC: c,
            active: true,
          });

          await EstorageEntityLink.create({
            entityId: publicEntity.id,
            linkType: 'public_frequency',
            linkValue: publicAlias,
            linkName: 'Public EnderStorage Frequency',
            isPrimary: true,
          });
        }
      }

      const transfer = await queueTransferByEntities({
        fromEntityId: publicEntity.id,
        toEntityId: requesterEntity.id,
        itemName,
        itemNbt,
        memo: undefined,
        quantity,
        timeout,
        requesterTier: request.apiKey.tier,
      });

      return res.success({
        transfer,
        sourceEntity: {
          id: publicEntity.id,
          name: publicEntity.name,
          type: publicEntity.entityType,
          alias: publicAlias ?? undefined,
        },
      });
    } catch (error) {
      console.error('Error creating public storage transfer request:', error);

      if (error instanceof WorkerLimitExceededError) {
        return res.error('TOO_MANY_WORKERS', error.message, 429);
      }

      const message = error instanceof Error ? error.message : 'Failed to create public transfer';
      return res.error('INTERNAL_ERROR', message, 500);
    }
  },
);

export default router;
