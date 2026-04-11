import { Router, json } from 'express';
import authenticateApiKeyTier from '../../../lib/authenticateApiKeyTier';
import { isTransferPayload } from '../../../lib/types';
import { RequestWithRateLimit } from '../types/request';
import { queueTransfer } from '../../ws';

const router = Router();

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

export default router;
