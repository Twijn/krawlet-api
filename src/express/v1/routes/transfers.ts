import { Router, json } from 'express';
import authenticateApiKeyTier from '../../../lib/authenticateApiKeyTier';
import { isTransferPayload } from '../../../lib/types';
import { RequestWithRateLimit } from '../types/request';
import { queueTransfer } from '../../ws';
import { cancelTransfer } from '../../ws/transferQueue';
import { RawTransfer, Transfer } from '../../../lib/models';

const router = Router();

export type RequestWithTransfer = RequestWithRateLimit & {
  transfer: RawTransfer;
};

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

    const transfer = await queueTransfer(
      { uuid: request.apiKey.mcUuid, name: request.apiKey.mcName },
      request.body.to,
      request.body.itemName,
      request.body.quantity,
    );

    return res.success({ message: 'Transfer queued successfully', transfer });
  } catch (error) {
    console.error('Error storing transfer data:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to queue transfer';
    return res.error('BAD_REQUEST', errorMessage, 400);
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
