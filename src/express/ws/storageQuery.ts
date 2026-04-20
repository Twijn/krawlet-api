import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { logPrefix, sendJson } from './protocol';
import { authState } from './state';
import {
  reserveWorkerSlot,
  trackStorageQueryFinished,
  trackStorageQueryStarted,
} from './workerActivity';
import { ApiKeyTier } from '../../lib/models/apikey.model';

const STORAGE_QUERY_TIMEOUT_MS = 5000;

export type StorageItem = {
  name: string;
  count: number;
  nbt?: string;
};

type PendingStorageQuery = {
  resolve: (items: StorageItem[]) => void;
  reject: (err: Error) => void;
  timeoutHandle: NodeJS.Timeout;
  workerId: number | undefined;
  requesterUuid: string;
};

/** requestId → pending query */
export const pendingStorageQueries = new Map<string, PendingStorageQuery>();

export function clearPendingStorageQuery(requestId: string): PendingStorageQuery | undefined {
  const pending = pendingStorageQueries.get(requestId);
  if (!pending) {
    return undefined;
  }

  clearTimeout(pending.timeoutHandle);
  pendingStorageQueries.delete(requestId);
  trackStorageQueryFinished(pending.requesterUuid);

  return pending;
}

/**
 * Reject all pending storage queries associated with the given WebSocket.
 * Called on worker disconnect.
 */
export function rejectStorageQueriesForWorker(ws: WebSocket): void {
  const state = authState.get(ws);
  if (!state) return;

  for (const [requestId, pending] of pendingStorageQueries.entries()) {
    if (pending.workerId === state.workerId) {
      clearPendingStorageQuery(requestId)?.reject(
        new Error('Worker disconnected before storage query completed'),
      );
    }
  }
}

/**
 * Ask a free authenticated worker to list the ender storage at the given frequency.
 * Resolves with the item list or rejects with an error (no worker, timeout, disconnect).
 */
export async function queryWorkerStorage({
  colors,
  requesterUuid,
  requesterTier,
}: {
  colors: [number, number, number];
  requesterUuid: string;
  requesterTier?: ApiKeyTier;
}): Promise<StorageItem[]> {
  // Find a free, authenticated worker
  let targetWs: WebSocket | null = null;
  let targetState = null;

  for (const [ws, state] of authState.entries()) {
    if (state.authenticated && !state.currentTask) {
      targetWs = ws;
      targetState = state;
      break;
    }
  }

  if (!targetWs || !targetState) {
    throw new Error('NO_WORKER_AVAILABLE');
  }

  const releaseReservedWorkerSlot = reserveWorkerSlot(requesterUuid, requesterTier);
  const requestId = randomUUID();

  return new Promise<StorageItem[]>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      clearPendingStorageQuery(requestId)?.reject(new Error('STORAGE_QUERY_TIMEOUT'));
    }, STORAGE_QUERY_TIMEOUT_MS);

    pendingStorageQueries.set(requestId, {
      resolve,
      reject,
      timeoutHandle,
      workerId: targetState!.workerId,
      requesterUuid,
    });
    trackStorageQueryStarted(requesterUuid);
    releaseReservedWorkerSlot();

    console.log(
      `${logPrefix(targetState!)} storage_list requestId=${requestId} colors=[${colors.join(',')}]`,
    );

    try {
      sendJson(targetWs!, {
        type: 'storage_list',
        id: requestId,
        payload: { colors },
      });
    } catch (error) {
      clearPendingStorageQuery(requestId);
      reject(error instanceof Error ? error : new Error('Failed to dispatch storage query'));
    }
  });
}
