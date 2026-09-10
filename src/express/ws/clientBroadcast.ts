import { RawTransfer, RawTransferNotification } from '#lib/models';
import { sendJson } from './protocol';
import { authState } from './state';
import { resolveClientEntityId } from './clientEntity';
import { attachMinecraftShorthand } from './transferShorthand';

function transferMatchesEntity(transfer: RawTransfer, entityId: string): boolean {
  return transfer.fromEntityId === entityId || transfer.toEntityId === entityId;
}

export async function broadcastTransferUpdate(transfer: RawTransfer): Promise<void> {
  for (const [ws, state] of authState.entries()) {
    if (!state.authenticated || state.role !== 'client' || !state.apiKeyId) {
      continue;
    }

    let entityId = state.clientEntityId;
    if (!entityId) {
      const resolvedEntityId = await resolveClientEntityId(state.apiKeyId);
      if (!resolvedEntityId) {
        continue;
      }

      entityId = resolvedEntityId;
      state.clientEntityId = resolvedEntityId;
      authState.set(ws, state);
    }

    if (!transferMatchesEntity(transfer, entityId)) {
      continue;
    }

    const [serializedTransfer] = await attachMinecraftShorthand([transfer]);
    sendJson(ws, {
      type: 'transfer_update',
      payload: serializedTransfer,
    });
  }
}

export async function broadcastTransferNotification(
  transfer: RawTransfer,
  notification: RawTransferNotification,
): Promise<void> {
  for (const [ws, state] of authState.entries()) {
    if (!state.authenticated || state.role !== 'client' || !state.apiKeyId) {
      continue;
    }

    let entityId = state.clientEntityId;
    if (!entityId) {
      const resolvedEntityId = await resolveClientEntityId(state.apiKeyId);
      if (!resolvedEntityId) {
        continue;
      }

      entityId = resolvedEntityId;
      state.clientEntityId = resolvedEntityId;
      authState.set(ws, state);
    }

    if (!transferMatchesEntity(transfer, entityId)) {
      continue;
    }

    sendJson(ws, {
      type: 'transfer_notification',
      payload: notification,
    });
  }
}
