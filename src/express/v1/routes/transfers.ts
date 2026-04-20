import { Router, json } from 'express';
import authenticateApiKeyTier from '../../../lib/authenticateApiKeyTier';
import { isTransferPayload } from '../../../lib/types';
import { RequestWithRateLimit } from '../types/request';
import { queueTransfer, queryWorkerStorage } from '../../ws';
import { cancelTransfer } from '../../ws/transferQueue';
import {
  EstorageEntity,
  EstorageEntityLink,
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

router.get('/', authenticateApiKeyTier('free', 'premium'), async (req, res) => {
  const request = req as RequestWithRateLimit;

  if (!request.apiKey) {
    return res.error('UNAUTHORIZED', 'API key required to access this endpoint', 401);
  }

  if (!request.apiKey.mcUuid || !request.apiKey.mcName) {
    return res.error('BAD_REQUEST', 'API key is missing associated Minecraft player data', 400);
  }

  const requesterEntity = await findEntityByPlayerUuid(request.apiKey.mcUuid);
  if (!requesterEntity) {
    return res.error(
      'BAD_REQUEST',
      'No ender storage entity is linked to this API key player UUID',
      400,
    );
  }

  try {
    const transfers = await Transfer.findAll({
      where: {
        [Op.or]: [{ fromEntityId: requesterEntity.id }, { toEntityId: requesterEntity.id }],
      },
      order: [['createdAt', 'DESC']],
    });

    return res.success(transfers.map((t) => t.raw()));
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
          [Op.ne]: 'service',
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

    return res.success(
      entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        type: entity.entityType,
        links: ((entity as any).links ?? []).map((link: EstorageEntityLink) => ({
          type: link.linkType,
          value: link.linkValue,
        })),
      })),
    );
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

    if (!request.apiKey.mcUuid || !request.apiKey.mcName) {
      return res.error('BAD_REQUEST', 'API key is missing associated Minecraft player data', 400);
    }

    if (!isTransferPayload(req.body)) {
      return res.error('BAD_REQUEST', 'Invalid transfer payload', 400);
    }

    const transfer = await queueTransfer({
      from: { uuid: request.apiKey.mcUuid, name: request.apiKey.mcName },
      to: request.body.to,
      itemName: request.body.itemName,
      itemNbt: request.body.itemNbt,
      quantity: request.body.quantity,
      timeout: request.body.timeout,
      requesterTier: request.apiKey.tier,
    });

    return res.success(transfer);
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

  if (!request.apiKey.mcUuid) {
    return res.error('BAD_REQUEST', 'API key is missing associated Minecraft player data', 400);
  }

  const requesterEntity = await findEntityByPlayerUuid(request.apiKey.mcUuid);

  if (!requesterEntity) {
    return res.error('NOT_FOUND', 'No ender storage entity found for this API key player', 404);
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

    if (!request.apiKey.mcUuid || !request.apiKey.mcName) {
      return res.error('BAD_REQUEST', 'API key is missing associated Minecraft player data', 400);
    }

    const requesterEntity = await findEntityByPlayerUuid(request.apiKey.mcUuid);
    if (!requesterEntity) {
      return res.error(
        'BAD_REQUEST',
        'No ender storage entity is linked to this API key player UUID',
        400,
      );
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

  return res.success(request.transfer);
});

router.post('/:transferId/cancel', authenticateApiKeyTier('free', 'premium'), async (req, res) => {
  const request = req as RequestWithTransfer;
  const { transferId } = req.params;

  try {
    const transfer = await cancelTransfer(transferId, request.requesterEntityId);

    if (!transfer) {
      return res.error('NOT_FOUND', 'Transfer not found or cannot be cancelled', 404);
    }

    return res.success(transfer);
  } catch (error) {
    console.error('Error cancelling transfer:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel transfer';
    return res.error('BAD_REQUEST', errorMessage, 400);
  }
});

export default router;
