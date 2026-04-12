import { ApiKey } from '../../lib/models/apikey.model';
import { RawTransfer } from '../../lib/models';
import { RawData, WebSocket } from 'ws';
import { parseClientMessage, sendError, sendJson, logPrefix } from './protocol';
import { authState } from './state';
import {
  AuthState,
  ClientAuthMessage,
  ClientMessage,
  MessageHandler,
  TransferUpdateMessage,
} from './types';
import { updateTransferStatus } from './transferQueue';

function getSocketAuthState(ws: WebSocket, messageId?: string | number): AuthState | null {
  const state = authState.get(ws);
  if (!state) {
    sendError(ws, 'AUTH_STATE_MISSING', 'Socket auth state not initialized', messageId);
    ws.close(1011, 'Server auth state error');
    return null;
  }

  return state;
}

async function handleAuthMessage(ws: WebSocket, parsed: ClientAuthMessage): Promise<void> {
  if (!parsed.token.startsWith('kraw_')) {
    sendError(ws, 'INVALID_TOKEN_FORMAT', 'API key must start with "kraw_"', parsed.id);
    return;
  }

  if (typeof parsed.workerId !== 'number') {
    sendError(
      ws,
      'INVALID_WORKER_ID',
      'Auth message must include a numeric workerId field',
      parsed.id,
    );
    return;
  }

  const hashedKey = ApiKey.hashKey(parsed.token);
  const apiKey = await ApiKey.findOne({
    where: {
      key: hashedKey,
      isActive: true,
    },
  });

  if (!apiKey) {
    sendError(ws, 'INVALID_TOKEN', 'Invalid or inactive API key', parsed.id);
    return;
  }

  if (apiKey.tier !== 'worker') {
    sendError(
      ws,
      'INVALID_TIER',
      `API key tier '${apiKey.tier}' is not allowed for WebSocket auth`,
      parsed.id,
    );
    return;
  }

  const currentState = authState.get(ws);
  if (!currentState) {
    return;
  }

  clearTimeout(currentState.timeoutHandle);
  currentState.authenticated = true;
  currentState.apiKeyId = apiKey.id;
  currentState.workerId = parsed.workerId;
  authState.set(ws, currentState);

  console.log(
    `${logPrefix(currentState)} authenticated with key=${apiKey.name} tier=${apiKey.tier} requestId=${parsed.id}`,
  );

  apiKey.incrementUsage().catch((err) => console.error('Failed to increment API key usage:', err));

  sendJson(ws, {
    id: parsed.id,
    type: 'auth_ok',
    payload: {
      tier: apiKey.tier,
      name: apiKey.name,
    },
  });
}

function parseTransferUpdateMessage(
  ws: WebSocket,
  message: ClientMessage,
): TransferUpdateMessage | null {
  if (typeof message.id !== 'string') {
    sendError(
      ws,
      'INVALID_TRANSFER_ID',
      'Transfer update messages must use a string transfer id',
      message.id,
    );
    return null;
  }

  return message as TransferUpdateMessage;
}

function getCurrentWorkerTransfer(
  ws: WebSocket,
  state: AuthState,
  message: TransferUpdateMessage,
): RawTransfer | null {
  if (!state.currentTask) {
    sendError(ws, 'NO_ACTIVE_TRANSFER', 'Worker has no active transfer to update', message.id);
    return null;
  }

  if (state.currentTask.id !== message.id) {
    sendError(
      ws,
      'TRANSFER_ID_MISMATCH',
      `Worker active transfer is ${state.currentTask.id}, received update for ${message.id}`,
      message.id,
    );
    return null;
  }

  return state.currentTask;
}

function normalizeMovedQuantity(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return null;
  }

  return Math.floor(value);
}

function clearCurrentTask(state: AuthState): void {
  state.currentTask = null;
  state.currentTaskCancelRequested = false;
}

const messageHandlers: Record<string, MessageHandler> = {
  auth: async (ws, message) => {
    if (!message.token) {
      sendError(ws, 'MISSING_TOKEN', 'Auth message must include a token field', message.id);
      return;
    }

    await handleAuthMessage(ws, message as ClientAuthMessage);
  },
  ping: (ws, message) => {
    sendJson(ws, {
      id: message.id,
      type: 'pong',
      payload: { ts: Date.now() },
    });
  },
  transfer_progress: async (ws, message, state) => {
    const parsed = parseTransferUpdateMessage(ws, message);
    if (!parsed) {
      return;
    }

    const transfer = getCurrentWorkerTransfer(ws, state, parsed);
    if (!transfer) {
      return;
    }

    if (state.currentTaskCancelRequested) {
      sendError(
        ws,
        'TRANSFER_CANCEL_PENDING',
        'Transfer cancellation is pending; progress updates are ignored',
        parsed.id,
      );
      return;
    }

    const moved = normalizeMovedQuantity(parsed.totalMoved);
    if (moved === null) {
      sendError(
        ws,
        'INVALID_TOTAL_MOVED',
        'transfer_progress requires a non-negative numeric totalMoved',
        parsed.id,
      );
      return;
    }

    await updateTransferStatus(transfer.id, 'in_progress', moved);

    console.log(
      `${logPrefix(state)} transfer progress transferId=${transfer.id} moved=${moved} requested=${parsed.requestedQuantity ?? 'any'} item=${parsed.itemName ?? 'any'} nbt=${parsed.itemNbt ?? 'any'}`,
    );

    sendJson(ws, {
      id: parsed.id,
      type: 'transfer_progress_ok',
      payload: {
        transferId: transfer.id,
        quantityTransferred: moved,
      },
    });
  },
  transfer_complete: async (ws, message, state) => {
    const parsed = parseTransferUpdateMessage(ws, message);
    if (!parsed) {
      return;
    }

    const transfer = getCurrentWorkerTransfer(ws, state, parsed);
    if (!transfer) {
      return;
    }

    const moved = normalizeMovedQuantity(parsed.totalMoved);
    if (moved === null) {
      sendError(
        ws,
        'INVALID_TOTAL_MOVED',
        'transfer_complete requires a non-negative numeric totalMoved',
        parsed.id,
      );
      return;
    }

    if (state.currentTaskCancelRequested) {
      await updateTransferStatus(transfer.id, 'cancelled', moved);

      console.warn(
        `${logPrefix(state)} transfer completion received after cancel request transferId=${transfer.id} moved=${moved}; finalized as cancelled`,
      );

      clearCurrentTask(state);
      authState.set(ws, state);

      sendJson(ws, {
        id: parsed.id,
        type: 'transfer_complete_ok',
        payload: {
          transferId: transfer.id,
          quantityTransferred: moved,
          status: 'cancelled',
        },
      });
      return;
    }

    await updateTransferStatus(transfer.id, 'completed', moved);

    console.log(
      `${logPrefix(state)} transfer complete transferId=${transfer.id} moved=${moved} requested=${parsed.requestedQuantity ?? 'any'} item=${parsed.itemName ?? 'any'} nbt=${parsed.itemNbt ?? 'any'} elapsedMs=${parsed.elapsedMs ?? 'n/a'}`,
    );

    clearCurrentTask(state);
    authState.set(ws, state);

    sendJson(ws, {
      id: parsed.id,
      type: 'transfer_complete_ok',
      payload: {
        transferId: transfer.id,
        quantityTransferred: moved,
      },
    });
  },
  transfer_cancelled: async (ws, message, state) => {
    const parsed = parseTransferUpdateMessage(ws, message);
    if (!parsed) {
      return;
    }

    const transfer = getCurrentWorkerTransfer(ws, state, parsed);
    if (!transfer) {
      return;
    }

    const moved =
      parsed.totalMoved === undefined
        ? transfer.quantityTransferred
        : normalizeMovedQuantity(parsed.totalMoved);

    if (moved === null) {
      sendError(
        ws,
        'INVALID_TOTAL_MOVED',
        'transfer_cancelled totalMoved must be a non-negative number',
        parsed.id,
      );
      return;
    }

    await updateTransferStatus(transfer.id, 'cancelled', moved);

    console.log(
      `${logPrefix(state)} transfer cancelled transferId=${transfer.id} moved=${moved} requested=${parsed.requestedQuantity ?? 'any'} item=${parsed.itemName ?? 'any'} nbt=${parsed.itemNbt ?? 'any'} elapsedMs=${parsed.elapsedMs ?? 'n/a'}`,
    );

    clearCurrentTask(state);
    authState.set(ws, state);

    sendJson(ws, {
      id: parsed.id,
      type: 'transfer_cancelled_ok',
      payload: {
        transferId: transfer.id,
        quantityTransferred: moved,
      },
    });
  },
  transfer_failed: async (ws, message, state) => {
    const parsed = parseTransferUpdateMessage(ws, message);
    if (!parsed) {
      return;
    }

    const transfer = getCurrentWorkerTransfer(ws, state, parsed);
    if (!transfer) {
      return;
    }

    if (state.currentTaskCancelRequested) {
      const movedAfterCancel =
        parsed.totalMoved === undefined
          ? transfer.quantityTransferred
          : normalizeMovedQuantity(parsed.totalMoved);

      if (movedAfterCancel === null) {
        sendError(
          ws,
          'INVALID_TOTAL_MOVED',
          'transfer_failed totalMoved must be a non-negative number',
          parsed.id,
        );
        return;
      }

      await updateTransferStatus(transfer.id, 'cancelled', movedAfterCancel);

      console.warn(
        `${logPrefix(state)} transfer failed after cancel request transferId=${transfer.id}; finalized as cancelled`,
      );

      clearCurrentTask(state);
      authState.set(ws, state);

      sendJson(ws, {
        id: parsed.id,
        type: 'transfer_failed_ok',
        payload: {
          transferId: transfer.id,
          quantityTransferred: movedAfterCancel,
          status: 'cancelled',
        },
      });
      return;
    }

    const moved =
      parsed.totalMoved === undefined
        ? transfer.quantityTransferred
        : normalizeMovedQuantity(parsed.totalMoved);

    if (moved === null) {
      sendError(
        ws,
        'INVALID_TOTAL_MOVED',
        'transfer_failed totalMoved must be a non-negative number',
        parsed.id,
      );
      return;
    }

    await updateTransferStatus(
      transfer.id,
      'failed',
      moved,
      parsed.reason || 'Transfer failed with unknown error',
    );

    console.warn(
      `${logPrefix(state)} transfer failed transferId=${transfer.id} reason=${parsed.reason || 'no reason provided'}`,
      {
        workerMessage: {
          reason: parsed.reason,
          workerId: parsed.workerId,
          requestedQuantity: parsed.requestedQuantity,
          itemName: parsed.itemName,
          itemNbt: parsed.itemNbt,
          elapsedMs: parsed.elapsedMs,
        },
      },
    );

    clearCurrentTask(state);
    authState.set(ws, state);

    sendJson(ws, {
      id: parsed.id,
      type: 'transfer_failed_ok',
      payload: {
        transferId: transfer.id,
        quantityTransferred: moved,
      },
    });
  },
};

export async function handleMessage(ws: WebSocket, raw: RawData): Promise<void> {
  const parsed = parseClientMessage(raw);
  if (!parsed) {
    sendError(ws, 'INVALID_JSON', 'Message must be valid JSON');
    return;
  }

  if (!parsed.type) {
    sendError(ws, 'INVALID_MESSAGE', 'Message must include a type field', parsed.id);
    return;
  }

  if (!parsed.id) {
    sendError(ws, 'MISSING_ID', 'Message must include an id field');
    return;
  }

  const state = getSocketAuthState(ws, parsed.id);
  if (!state) {
    return;
  }

  console.log(
    `${logPrefix(state)} message type=${parsed.type} id=${parsed.id} authenticated=${state.authenticated}`,
  );

  const handler = messageHandlers[parsed.type];
  if (!handler) {
    sendError(ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${parsed.type}`, parsed.id);
    return;
  }

  if (!state.authenticated && parsed.type !== 'auth') {
    sendError(
      ws,
      'UNAUTHENTICATED',
      'Authenticate first using { type: "auth", token: "kraw_...", id: "..." }',
      parsed.id,
    );
    return;
  }

  await handler(ws, parsed, state);
}
