import { ApiKey } from '../../lib/models/apikey.model';
import {
  EstorageEntity,
  findEntityById,
  findEntityByLookup,
  findEntityByPlayerUuid,
  Transfer,
} from '../../lib/models';
import { isTransferPayload } from '../../lib/types/Transfer';
import { sendError, sendJson, logPrefix } from './protocol';
import { queueTransferByEntities, cancelTransfer } from './transferQueue';
import { WorkerLimitExceededError } from './workerActivity';
import { MessageHandler } from './types';

async function resolveClientEntity(apiKeyId: string): Promise<EstorageEntity | null> {
  const apiKey = await ApiKey.findByPk(apiKeyId);
  if (!apiKey) return null;

  if (apiKey.estorageEntityId) {
    const entity = await findEntityById(apiKey.estorageEntityId);
    if (entity) return entity;
  }

  if (apiKey.mcUuid) {
    const entity = await findEntityByPlayerUuid(apiKey.mcUuid);
    if (entity) return entity;
  }

  return null;
}

export const clientMessageHandlers: Record<string, MessageHandler> = {
  create_transfer: async (ws, message, state) => {
    if (!state.apiKeyId) {
      sendError(ws, 'INTERNAL_ERROR', 'API key ID missing from auth state', message.id);
      return;
    }

    const payload = (message as any).payload;
    if (!isTransferPayload(payload)) {
      sendError(
        ws,
        'INVALID_PAYLOAD',
        'create_transfer requires a payload with at least a "to" field',
        message.id,
      );
      return;
    }

    const timeout =
      typeof (payload as any).timeout === 'number' && (payload as any).timeout > 0
        ? (payload as any).timeout
        : undefined;

    const requesterEntity = await resolveClientEntity(state.apiKeyId);
    if (!requesterEntity) {
      sendError(
        ws,
        'NO_ENTITY_LINK',
        'API key is not linked to an ender storage entity. Ask an admin to provision your key with an entity link.',
        message.id,
      );
      return;
    }

    const toEntity = await findEntityByLookup(payload.to);
    if (!toEntity) {
      sendError(
        ws,
        'TARGET_NOT_FOUND',
        `Transfer target not found: ${payload.to}. Use an entity id, entity name, or configured link value.`,
        message.id,
      );
      return;
    }

    const apiKey = await ApiKey.findByPk(state.apiKeyId);
    const requesterTier = apiKey?.tier;

    try {
      const transfer = await queueTransferByEntities({
        fromEntityId: requesterEntity.id,
        toEntityId: toEntity.id,
        itemName: payload.itemName,
        itemNbt: payload.itemNbt,
        memo: payload.memo,
        quantity: payload.quantity,
        timeout,
        requesterTier,
      });

      console.log(
        `${logPrefix(state)} create_transfer transferId=${transfer.id} from=${requesterEntity.name} to=${toEntity.name}`,
      );

      sendJson(ws, {
        id: message.id,
        type: 'create_transfer_ok',
        payload: transfer,
      });
    } catch (err) {
      if (err instanceof WorkerLimitExceededError) {
        sendError(ws, 'TOO_MANY_WORKERS', err.message, message.id);
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to queue transfer';
      sendError(ws, 'BAD_REQUEST', errorMessage, message.id);
    }
  },

  get_transfer: async (ws, message, state) => {
    if (!state.apiKeyId) {
      sendError(ws, 'INTERNAL_ERROR', 'API key ID missing from auth state', message.id);
      return;
    }

    const payload = (message as any).payload;
    if (!payload || typeof payload.transferId !== 'string') {
      sendError(
        ws,
        'INVALID_PAYLOAD',
        'get_transfer requires a payload with a "transferId" string field',
        message.id,
      );
      return;
    }

    const requesterEntity = await resolveClientEntity(state.apiKeyId);
    if (!requesterEntity) {
      sendError(
        ws,
        'NO_ENTITY_LINK',
        'API key is not linked to an ender storage entity',
        message.id,
      );
      return;
    }

    const transfer = await Transfer.findOne({ where: { id: payload.transferId } });
    if (!transfer) {
      sendError(ws, 'NOT_FOUND', 'Transfer not found', message.id);
      return;
    }

    const raw = transfer.raw();
    if (raw.fromEntityId !== requesterEntity.id && raw.toEntityId !== requesterEntity.id) {
      sendError(ws, 'FORBIDDEN', 'You do not have permission to access this transfer', message.id);
      return;
    }

    sendJson(ws, {
      id: message.id,
      type: 'get_transfer_ok',
      payload: raw,
    });
  },

  cancel_transfer: async (ws, message, state) => {
    if (!state.apiKeyId) {
      sendError(ws, 'INTERNAL_ERROR', 'API key ID missing from auth state', message.id);
      return;
    }

    const payload = (message as any).payload;
    if (!payload || typeof payload.transferId !== 'string') {
      sendError(
        ws,
        'INVALID_PAYLOAD',
        'cancel_transfer requires a payload with a "transferId" string field',
        message.id,
      );
      return;
    }

    const requesterEntity = await resolveClientEntity(state.apiKeyId);
    if (!requesterEntity) {
      sendError(
        ws,
        'NO_ENTITY_LINK',
        'API key is not linked to an ender storage entity',
        message.id,
      );
      return;
    }

    try {
      const transfer = await cancelTransfer(payload.transferId, requesterEntity.id);
      if (!transfer) {
        sendError(ws, 'NOT_FOUND', 'Transfer not found or cannot be cancelled', message.id);
        return;
      }

      console.log(`${logPrefix(state)} cancel_transfer transferId=${transfer.id}`);

      sendJson(ws, {
        id: message.id,
        type: 'cancel_transfer_ok',
        payload: transfer,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel transfer';
      sendError(ws, 'BAD_REQUEST', errorMessage, message.id);
    }
  },
};
