import { Router, json } from 'express';
import authenticateApiKeyTier from '../../../lib/authenticateApiKeyTier';
import { isTransferPayload } from '../../../lib/types';
import { RequestWithRateLimit } from '../types/request';
import { queueTransfer, queryWorkerStorage } from '../../ws';
import { cancelTransfer } from '../../ws/transferQueue';
import { Player, RawTransfer, Transfer } from '../../../lib/models';
import { Op } from 'sequelize';

const router = Router();

export type RequestWithTransfer = RequestWithRateLimit & {
  transfer: RawTransfer;
};

router.get('/', authenticateApiKeyTier('free', 'premium'), async (req, res) => {
  const request = req as RequestWithRateLimit;

  if (!request.apiKey) {
    return res.error('UNAUTHORIZED', 'API key required to access this endpoint', 401);
  }

  if (!request.apiKey.mcUuid || !request.apiKey.mcName) {
    return res.error('BAD_REQUEST', 'API key is missing associated Minecraft player data', 400);
  }

  try {
    const transfers = await Transfer.findAll({
      where: {
        [Op.or]: [{ fromUUID: request.apiKey.mcUuid }, { toUUID: request.apiKey.mcUuid }],
      },
      order: [['createdAt', 'DESC']],
    });

    return res.success({ transfers: transfers.map((t) => t.raw()) });
  } catch (error) {
    console.error('Error fetching transfers:', error);
    return res.error('INTERNAL_SERVER_ERROR', 'Failed to fetch transfers', 500);
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
    });

    return res.success({ message: 'Transfer queued successfully', transfer });
  } catch (error) {
    console.error('Error storing transfer data:', error);

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

  const player = await Player.findOne({ where: { minecraftUUID: request.apiKey.mcUuid } });

  if (!player) {
    return res.error('NOT_FOUND', 'Player not found for this API key', 404);
  }

  if (!player.estorageColorA || !player.estorageColorB || !player.estorageColorC) {
    return res.error('BAD_REQUEST', 'Player is missing ender storage color data', 400);
  }

  try {
    const items = await queryWorkerStorage([
      player.estorageColorA,
      player.estorageColorB,
      player.estorageColorC,
    ]);

    return res.success({ items });
  } catch (err) {
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

    const transfer = await Transfer.findOne({ where: { id: transferId } });

    if (!transfer) {
      return res.error('NOT_FOUND', 'Transfer not found', 404);
    }

    if (transfer.fromUUID !== request.apiKey.mcUuid && transfer.toUUID !== request.apiKey.mcUuid) {
      return res.error('FORBIDDEN', 'You do not have permission to access this transfer', 403);
    }

    // Attach transfer to request for downstream handlers
    (req as RequestWithTransfer).transfer = transfer.raw();
    next();
  },
);

router.get('/:transferId', authenticateApiKeyTier('free', 'premium'), async (req, res) => {
  const request = req as RequestWithTransfer;

  return res.success({ transfer: request.transfer });
});

router.post('/:transferId/cancel', authenticateApiKeyTier('free', 'premium'), async (req, res) => {
  const request = req as RequestWithTransfer;
  const { transferId } = req.params;

  try {
    const transfer = await cancelTransfer(transferId, request.apiKey!.mcUuid!);

    if (!transfer) {
      return res.error('NOT_FOUND', 'Transfer not found or cannot be cancelled', 404);
    }

    return res.success({ message: 'Transfer cancelled successfully', transfer });
  } catch (error) {
    console.error('Error cancelling transfer:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel transfer';
    return res.error('BAD_REQUEST', errorMessage, 400);
  }
});

export default router;
