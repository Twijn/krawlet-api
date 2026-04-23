import { RawTransfer } from '../../lib/models';
import { completeTransfer } from '../../chat';
import { WebSocket } from 'ws';
import { sendError, sendJson, logPrefix } from './protocol';
import { authState } from './state';
import {
  AuthState,
  ClientMessage,
  MessageHandler,
  StorageListResultMessage,
  TransferUpdateMessage,
} from './types';
import { updateTransferStatus } from './transferQueue';
import { clearPendingStorageQuery, pendingStorageQueries } from './storageQuery';

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

export const workerMessageHandlers: Record<string, MessageHandler> = {
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

    await updateTransferStatus(transfer.id, 'in_progress', moved, undefined, {
      itemName: parsed.itemName,
      itemDisplayName: parsed.itemDisplayName,
    });

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
      await updateTransferStatus(transfer.id, 'cancelled', moved, undefined, {
        itemName: parsed.itemName,
        itemDisplayName: parsed.itemDisplayName,
      });
      completeTransfer(
        {
          ...transfer,
          status: 'cancelled',
          quantityTransferred: moved,
          itemName: transfer.itemName ?? parsed.itemName,
          itemDisplayName: transfer.itemDisplayName ?? parsed.itemDisplayName,
        },
        'Transfer was cancelled',
      );

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

    await updateTransferStatus(transfer.id, 'completed', moved, undefined, {
      itemName: parsed.itemName,
      itemDisplayName: parsed.itemDisplayName,
    });
    completeTransfer({
      ...transfer,
      status: 'completed',
      quantityTransferred: moved,
      itemName: transfer.itemName ?? parsed.itemName,
      itemDisplayName: transfer.itemDisplayName ?? parsed.itemDisplayName,
    });

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

    await updateTransferStatus(transfer.id, 'cancelled', moved, undefined, {
      itemName: parsed.itemName,
      itemDisplayName: parsed.itemDisplayName,
    });
    completeTransfer(
      {
        ...transfer,
        status: 'cancelled',
        quantityTransferred: moved,
        itemName: transfer.itemName ?? parsed.itemName,
        itemDisplayName: transfer.itemDisplayName ?? parsed.itemDisplayName,
      },
      'Transfer was cancelled',
    );

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

  storage_list_result: (ws, message, state) => {
    const parsed = message as StorageListResultMessage;
    const requestId = typeof parsed.id === 'string' ? parsed.id : String(parsed.id);
    const pending = pendingStorageQueries.get(requestId);

    if (!pending) {
      console.warn(`${logPrefix(state)} storage_list_result for unknown requestId=${requestId}`);
      return;
    }

    clearPendingStorageQuery(requestId);

    const items = (parsed.payload?.items ?? []) as { name: string; count: number; nbt?: string }[];
    console.log(
      `${logPrefix(state)} storage_list_result requestId=${requestId} itemSlots=${items.length}`,
    );
    pending.resolve(items);
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

      await updateTransferStatus(transfer.id, 'cancelled', movedAfterCancel, undefined, {
        itemName: parsed.itemName,
        itemDisplayName: parsed.itemDisplayName,
      });
      completeTransfer(
        {
          ...transfer,
          status: 'cancelled',
          quantityTransferred: movedAfterCancel,
          itemName: transfer.itemName ?? parsed.itemName,
          itemDisplayName: transfer.itemDisplayName ?? parsed.itemDisplayName,
        },
        'Transfer was cancelled',
      );

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
      {
        itemName: parsed.itemName,
        itemDisplayName: parsed.itemDisplayName,
      },
    );
    completeTransfer(
      {
        ...transfer,
        status: 'failed',
        quantityTransferred: moved,
        itemName: transfer.itemName ?? parsed.itemName,
        itemDisplayName: transfer.itemDisplayName ?? parsed.itemDisplayName,
      },
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
          itemDisplayName: parsed.itemDisplayName,
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
