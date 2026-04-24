import { ApiKey } from '../../lib/models/apikey.model';
import {
  EstorageEntity,
  EstorageEntityLink,
  findEntityById,
  findEntityByLookup,
  Transfer,
} from '../../lib/models';
import { isTransferPayload, isWsTransferNotificationPayload } from '../../lib/types/Transfer';
import { Op } from 'sequelize';
import { sendError, sendJson, logPrefix } from './protocol';
import { queueTransferByEntities, cancelTransfer } from './transferQueue';
import { WorkerLimitExceededError } from './workerActivity';
import { MessageHandler } from './types';
import { resolveClientEntityId } from './clientEntity';
import {
  attachTransferNotifications,
  createTransferNotification,
} from '../../lib/transferNotifications';
import { broadcastTransferNotification } from './clientBroadcast';

async function resolveClientEntity(apiKeyId: string): Promise<EstorageEntity | null> {
  const entityId = await resolveClientEntityId(apiKeyId);
  if (!entityId) {
    return null;
  }

  return findEntityById(entityId);
}

function shouldIncludeNotifications(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const parseFlag = (value: unknown): boolean => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === '1' || normalized === 'true' || normalized === 'yes';
    }

    return false;
  };

  const typedPayload = payload as {
    inclNotifs?: unknown;
    inclNotifications?: unknown;
    includeNotifications?: unknown;
  };

  return (
    parseFlag(typedPayload.inclNotifs) ||
    parseFlag(typedPayload.inclNotifications) ||
    parseFlag(typedPayload.includeNotifications)
  );
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

      const [serializedTransfer] = await attachMinecraftShorthand([transfer]);

      sendJson(ws, {
        id: message.id,
        type: 'create_transfer_ok',
        payload: serializedTransfer,
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

    const includeNotifications = shouldIncludeNotifications(payload);
    const [transferWithNotifications] = await attachTransferNotifications(
      [raw],
      includeNotifications,
    );
    const [serializedTransfer] = await attachMinecraftShorthand([transferWithNotifications]);

    sendJson(ws, {
      id: message.id,
      type: 'get_transfer_ok',
      payload: serializedTransfer,
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

      const [serializedTransfer] = await attachMinecraftShorthand([transfer]);

      sendJson(ws, {
        id: message.id,
        type: 'cancel_transfer_ok',
        payload: serializedTransfer,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel transfer';
      sendError(ws, 'BAD_REQUEST', errorMessage, message.id);
    }
  },

  list_transfers: async (ws, message, state) => {
    if (!state.apiKeyId) {
      sendError(ws, 'INTERNAL_ERROR', 'API key ID missing from auth state', message.id);
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
      const transfers = await Transfer.findAll({
        where: {
          [Op.or]: [{ fromEntityId: requesterEntity.id }, { toEntityId: requesterEntity.id }],
        },
        order: [['createdAt', 'DESC']],
      });

      console.log(`${logPrefix(state)} list_transfers count=${transfers.length}`);

      const includeNotifications = shouldIncludeNotifications((message as any).payload);
      const rawTransfers = transfers.map((t) => t.raw());
      const transfersWithNotifications = await attachTransferNotifications(
        rawTransfers,
        includeNotifications,
      );

      sendJson(ws, {
        id: message.id,
        type: 'list_transfers_ok',
        payload: {
          transfers: await attachMinecraftShorthand(transfersWithNotifications),
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to list transfers';
      sendError(ws, 'INTERNAL_ERROR', errorMessage, message.id);
    }
  },

  notify_transfer: async (ws, message, state) => {
    if (!state.apiKeyId) {
      sendError(ws, 'INTERNAL_ERROR', 'API key ID missing from auth state', message.id);
      return;
    }

    const payload = (message as any).payload;
    if (!isWsTransferNotificationPayload(payload)) {
      sendError(
        ws,
        'INVALID_PAYLOAD',
        'notify_transfer requires payload { transferId: string, type?: "error"|"info"|"success", message: string }',
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

    const rawTransfer = transfer.raw();
    if (
      rawTransfer.fromEntityId !== requesterEntity.id &&
      rawTransfer.toEntityId !== requesterEntity.id
    ) {
      sendError(ws, 'FORBIDDEN', 'You do not have permission to access this transfer', message.id);
      return;
    }

    try {
      const notification = await createTransferNotification({
        transferId: rawTransfer.id,
        senderEntityId: requesterEntity.id,
        type: payload.type,
        message: payload.message,
      });

      await broadcastTransferNotification(rawTransfer, notification);

      sendJson(ws, {
        id: message.id,
        type: 'notify_transfer_ok',
        payload: notification,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create notification';
      sendError(ws, 'BAD_REQUEST', errorMessage, message.id);
    }
  },

  list_targets: async (ws, message, state) => {
    if (!state.apiKeyId) {
      sendError(ws, 'INTERNAL_ERROR', 'API key ID missing from auth state', message.id);
      return;
    }

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

      const targets = serializeTransferTargets(entities);

      console.log(`${logPrefix(state)} list_targets count=${targets.length}`);

      sendJson(ws, {
        id: message.id,
        type: 'list_targets_ok',
        payload: {
          targets,
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to list targets';
      sendError(ws, 'INTERNAL_ERROR', errorMessage, message.id);
    }
  },
};

type PlayerLink = {
  mcUuid?: string;
  mcName?: string;
};

type RawTransferWithMinecraftShorthand = ReturnType<Transfer['raw']> & {
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
  transfers: ReturnType<Transfer['raw']>[],
): Promise<RawTransferWithMinecraftShorthand[]> {
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

function serializeTransferTargets(entities: EstorageEntity[]) {
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
