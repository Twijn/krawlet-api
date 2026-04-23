import { Router, json } from 'express';
import authenticateApiKeyTier from '../../../lib/authenticateApiKeyTier';
import { isTransferPayload } from '../../../lib/types';
import { RequestWithRateLimit } from '../types/request';
import { queueTransferByEntities, queryWorkerStorage } from '../../ws';
import { cancelTransfer } from '../../ws/transferQueue';
import {
  EstorageEntity,
  EstorageEntityLink,
  findEntityById,
  findEntityByLookup,
  findEntityByPlayerUuid,
  RawTransfer,
  Transfer,
} from '../../../lib/models';
import { Op } from 'sequelize';
import { WorkerLimitExceededError } from '../../ws/workerActivity';

const router = Router();

export type RequestWithTransfer = RequestWithRateLimit & {
  transfer: RawTransfer;
  requesterEntityId: string;
};

type PlayerLink = {
  mcUuid?: string;
  mcName?: string;
};

type TransferTarget = {
  id: string;
  name: string;
  type: string;
  links: { type: string; value: string }[];
  mcUuid?: string;
  mcName?: string;
};

type TransferWithMinecraftShorthand = RawTransfer & {
  fromMcUuid?: string;
  fromMcName?: string;
  toMcUuid?: string;
  toMcName?: string;
};

function mapPlayerLinks(links: EstorageEntityLink[]): Map<string, PlayerLink> {
  const byEntity = new Map<string, PlayerLink>();

  for (const link of links) {
    if (link.linkType !== 'player_uuid') {
      continue;
    }

    if (!byEntity.has(link.entityId)) {
      byEntity.set(link.entityId, {
        mcUuid: link.linkValue,
        mcName: link.linkName ?? undefined,
      });
    }
  }

  return byEntity;
}

async function attachMinecraftShorthand(
  transfers: RawTransfer[],
): Promise<TransferWithMinecraftShorthand[]> {
  if (transfers.length === 0) {
    return [];
  }

  const entityIds = Array.from(
    new Set(transfers.flatMap((transfer) => [transfer.fromEntityId, transfer.toEntityId])),
  );

  const links = await EstorageEntityLink.findAll({
    where: {
      entityId: {
        [Op.in]: entityIds,
      },
      linkType: 'player_uuid',
    },
    attributes: ['entityId', 'linkType', 'linkValue', 'linkName'],
    order: [
      ['isPrimary', 'DESC'],
      ['createdAt', 'ASC'],
    ],
  });

  const playerLinks = mapPlayerLinks(links);

  return transfers.map((transfer) => {
    const fromLink = playerLinks.get(transfer.fromEntityId);
    const toLink = playerLinks.get(transfer.toEntityId);

    return {
      ...transfer,
      fromMcUuid: fromLink?.mcUuid,
      fromMcName: fromLink?.mcName,
      toMcUuid: toLink?.mcUuid,
      toMcName: toLink?.mcName,
    };
  });
}

function serializeTransferTargets(entities: EstorageEntity[]): TransferTarget[] {
  return entities.map((entity) => {
    const links = ((entity as any).links ?? []) as EstorageEntityLink[];
    const playerLink = links.find((link) => link.linkType === 'player_uuid');

    return {
      id: entity.id,
      name: entity.name,
      type: entity.entityType,
      links: links.map((link) => ({
        type: link.linkType,
        value: link.linkValue,
      })),
      mcUuid: playerLink?.linkValue,
      mcName: playerLink?.linkName ?? undefined,
    };
  });
}

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

router.get('/', authenticateApiKeyTier('free', 'premium'), async (req, res) => {
  const request = req as RequestWithRateLimit;

  if (!request.apiKey) {
    return res.error('UNAUTHORIZED', 'API key required to access this endpoint', 401);
  }

  const resolved = await resolveRequesterEntity(request);
  const requesterEntity = resolved.entity;
  if (!requesterEntity) {
    return res.error('BAD_REQUEST', resolved.error ?? 'Unable to resolve requester entity', 400);
  }

  try {
    const transfers = await Transfer.findAll({
      where: {
        [Op.or]: [{ fromEntityId: requesterEntity.id }, { toEntityId: requesterEntity.id }],
      },
      order: [['createdAt', 'DESC']],
    });

    const rawTransfers = transfers.map((t) => t.raw());
    return res.success(await attachMinecraftShorthand(rawTransfers));
  } catch (error) {
    console.error('Error fetching transfers:', error);
    return res.error('INTERNAL_SERVER_ERROR', 'Failed to fetch transfers', 500);
  }
});

router.get('/targets', authenticateApiKeyTier('free', 'premium'), async (req, res) => {
  try {
    const entities = await EstorageEntity.findAll({
      where: {
        active: true,
        entityType: {
          [Op.notIn]: ['service', 'public'],
        },
      },
      order: [['name', 'ASC']],
      include: [
        {
          model: EstorageEntityLink,
          as: 'links',
          attributes: ['linkType', 'linkValue'],
          required: false,
        },
      ],
    });

    return res.success(serializeTransferTargets(entities));
  } catch (error) {
    console.error('Error fetching transfer targets:', error);
    return res.error('INTERNAL_SERVER_ERROR', 'Failed to fetch transfer targets', 500);
  }
});

router.post('/', authenticateApiKeyTier('free', 'premium'), json(), async (req, res) => {
  const request = req as RequestWithRateLimit;
  try {
    if (!request.apiKey) {
      return res.error('UNAUTHORIZED', 'API key required to access this endpoint', 401);
    }

    if (!isTransferPayload(req.body)) {
      return res.error('BAD_REQUEST', 'Invalid transfer payload', 400);
    }

    const resolved = await resolveRequesterEntity(request);
    const requesterEntity = resolved.entity;
    if (!requesterEntity) {
      return res.error('BAD_REQUEST', resolved.error ?? 'Unable to resolve requester entity', 400);
    }

    const toEntity = await findEntityByLookup(request.body.to);
    if (!toEntity) {
      return res.error(
        'BAD_REQUEST',
        `Transfer target not found: ${request.body.to}. Use an entity id, entity name, or configured link value.`,
        400,
      );
    }

    const transfer = await queueTransferByEntities({
      fromEntityId: requesterEntity.id,
      toEntityId: toEntity.id,
      itemName: request.body.itemName,
      itemNbt: request.body.itemNbt,
      memo: request.body.memo,
      quantity: request.body.quantity,
      timeout: request.body.timeout,
      requesterTier: request.apiKey.tier,
    });

    const [serializedTransfer] = await attachMinecraftShorthand([transfer]);
    return res.success(serializedTransfer);
  } catch (error) {
    console.error('Error storing transfer data:', error);

    if (error instanceof WorkerLimitExceededError) {
      return res.error('TOO_MANY_WORKERS', error.message, 429);
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to queue transfer';
    return res.error('BAD_REQUEST', errorMessage, 400);
  }
});

// GET /v1/transfers/contents - Live ender storage contents via worker
router.get('/contents', authenticateApiKeyTier('free', 'premium'), async (req, res) => {
  const request = req as RequestWithRateLimit;

  if (!request.apiKey) {
    return res.error('UNAUTHORIZED', 'API key required to access this endpoint', 401);
  }

  const resolved = await resolveRequesterEntity(request);
  const requesterEntity = resolved.entity;

  if (!requesterEntity) {
    return res.error('BAD_REQUEST', resolved.error ?? 'Unable to resolve requester entity', 400);
  }

  try {
    const items = await queryWorkerStorage({
      colors: [requesterEntity.colorA, requesterEntity.colorB, requesterEntity.colorC],
      requesterUuid: requesterEntity.id,
      requesterTier: request.apiKey.tier,
    });

    return res.success({ items });
  } catch (err) {
    if (err instanceof WorkerLimitExceededError) {
      return res.error('TOO_MANY_WORKERS', err.message, 429);
    }

    const message = err instanceof Error ? err.message : 'Unknown error';

    if (message === 'NO_WORKER_AVAILABLE') {
      return res.error(
        'SERVICE_UNAVAILABLE',
        'No worker is available to process this request',
        503,
      );
    }

    if (message === 'STORAGE_QUERY_TIMEOUT') {
      return res.error('SERVICE_UNAVAILABLE', 'Worker did not respond in time', 503);
    }

    if (message.startsWith('Worker disconnected')) {
      return res.error(
        'SERVICE_UNAVAILABLE',
        'Worker disconnected before the query completed',
        503,
      );
    }

    console.error('Unexpected storage query error:', err);
    return res.error('INTERNAL_ERROR', 'Failed to retrieve storage contents', 500);
  }
});

router.use(
  '/:transferId',
  authenticateApiKeyTier('free', 'premium'),
  json(),
  async (req, res, next) => {
    const request = req as RequestWithTransfer;
    const { transferId } = req.params;

    if (!request.apiKey) {
      return res.error('UNAUTHORIZED', 'API key required to access this endpoint', 401);
    }

    const resolved = await resolveRequesterEntity(request);
    const requesterEntity = resolved.entity;
    if (!requesterEntity) {
      return res.error('BAD_REQUEST', resolved.error ?? 'Unable to resolve requester entity', 400);
    }

    const transfer = await Transfer.findOne({ where: { id: transferId } });

    if (!transfer) {
      return res.error('NOT_FOUND', 'Transfer not found', 404);
    }

    if (
      transfer.fromEntityId !== requesterEntity.id &&
      transfer.toEntityId !== requesterEntity.id
    ) {
      return res.error('FORBIDDEN', 'You do not have permission to access this transfer', 403);
    }

    // Attach transfer to request for downstream handlers
    (req as RequestWithTransfer).transfer = transfer.raw();
    (req as RequestWithTransfer).requesterEntityId = requesterEntity.id;
    next();
  },
);

router.get('/:transferId', authenticateApiKeyTier('free', 'premium'), async (req, res) => {
  const request = req as RequestWithTransfer;
  const [serializedTransfer] = await attachMinecraftShorthand([request.transfer]);

  return res.success(serializedTransfer);
});

router.post('/:transferId/cancel', authenticateApiKeyTier('free', 'premium'), async (req, res) => {
  const request = req as RequestWithTransfer;
  const { transferId } = req.params;

  try {
    const transfer = await cancelTransfer(transferId, request.requesterEntityId);

    if (!transfer) {
      return res.error('NOT_FOUND', 'Transfer not found or cannot be cancelled', 404);
    }

    const [serializedTransfer] = await attachMinecraftShorthand([transfer]);
    return res.success(serializedTransfer);
  } catch (error) {
    console.error('Error cancelling transfer:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel transfer';
    return res.error('BAD_REQUEST', errorMessage, 400);
  }
});

export default router;
