import { WebSocket } from 'ws';
import {
  findEntityById,
  findEntityByLookup,
  findEntityByPlayerUuid,
  RawTransfer,
  Transfer,
  TransferStatus,
} from '../../lib/models';
import { logPrefix, sendJson } from './protocol';
import { authState } from './state';
import { AuthState } from './types';
import { reserveWorkerSlot, trackTransferFinished, trackTransferStarted } from './workerActivity';
import { ApiKeyTier } from '../../lib/models/apikey.model';
import { broadcastTransferUpdate } from './clientBroadcast';

let activeTransfers: RawTransfer[] = [];

let queueHydrated = false;
let queueHydrationPromise: Promise<void> | null = null;

export type QueueTransferParams = {
  from: { uuid: string; name: string };
  to: string;
  itemName?: string;
  itemDisplayName?: string;
  itemNbt?: string;
  memo?: string;
  quantity?: number;
  timeout?: number;
  requesterTier?: ApiKeyTier;
};

export type QueueTransferByEntityParams = {
  fromEntityId: string;
  toEntityId: string;
  itemName?: string;
  itemDisplayName?: string;
  itemNbt?: string;
  memo?: string;
  quantity?: number;
  timeout?: number;
  requesterTier?: ApiKeyTier;
};

async function queueTransferWithEntities({
  fromEntityId,
  toEntityId,
  itemName,
  itemDisplayName,
  itemNbt,
  memo,
  quantity,
  timeout,
  requesterTier,
}: QueueTransferByEntityParams): Promise<RawTransfer> {
  const fromEntity = await findEntityById(fromEntityId);
  const toEntity = await findEntityById(toEntityId);

  if (!fromEntity) {
    throw new Error(`Source entity not found: ${fromEntityId}`);
  }

  if (!toEntity) {
    throw new Error(`Destination entity not found: ${toEntityId}`);
  }

  if (toEntity.id === fromEntity.id) {
    throw new Error('Cannot transfer to the same ender storage entity');
  }

  if (timeout) {
    if (timeout < 0) {
      throw new Error('Timeout must be a positive number');
    } else if (timeout > 30) {
      throw new Error('Timeout cannot exceed 30 seconds');
    }
  }

  const releaseReservedWorkerSlot = reserveWorkerSlot(toEntity.id, requesterTier);

  try {
    const transfer = await Transfer.create(
      {
        fromEntityId: fromEntity.id,
        fromName: fromEntity.name,
        toEntityId: toEntity.id,
        toName: toEntity.name,
        itemName,
        itemDisplayName,
        itemNbt,
        memo,
        quantity,
        timeout,
      },
      {
        returning: true,
      },
    );

    const rawTransfer = transfer.raw();
    activeTransfers.push(rawTransfer);
    trackTransferStarted(rawTransfer.fromEntityId);
    void broadcastTransferUpdate(rawTransfer);

    return rawTransfer;
  } finally {
    releaseReservedWorkerSlot();
  }
}

export async function queueTransfer(params: QueueTransferParams): Promise<RawTransfer> {
  const { from, to, itemName, itemDisplayName, itemNbt, memo, quantity, timeout, requesterTier } =
    params;
  const fromEntity = await findEntityByPlayerUuid(from.uuid);
  const toEntity = await findEntityByLookup(to);

  if (!fromEntity) {
    throw new Error(`No ender storage entity is linked to your player UUID (${from.uuid})`);
  }

  if (!toEntity) {
    throw new Error(
      `Transfer target not found: ${to}. Use an entity id, entity name, or configured link value.`,
    );
  }

  return queueTransferWithEntities({
    fromEntityId: fromEntity.id,
    toEntityId: toEntity.id,
    itemName,
    itemDisplayName,
    itemNbt,
    memo,
    quantity,
    timeout,
    requesterTier,
  });
}

export async function queueTransferByEntities(
  params: QueueTransferByEntityParams,
): Promise<RawTransfer> {
  return queueTransferWithEntities(params);
}

function ensureActiveTransfer(rawTransfer: RawTransfer): void {
  const existingIndex = activeTransfers.findIndex((transfer) => transfer.id === rawTransfer.id);
  if (existingIndex === -1) {
    activeTransfers.push(rawTransfer);
    trackTransferStarted(rawTransfer.fromEntityId);
    return;
  }

  activeTransfers[existingIndex] = {
    ...activeTransfers[existingIndex],
    ...rawTransfer,
  };
}

export async function initializeTransferQueue(): Promise<void> {
  if (queueHydrated) {
    return;
  }

  if (queueHydrationPromise) {
    await queueHydrationPromise;
    return;
  }

  queueHydrationPromise = (async () => {
    const staleInProgress = await Transfer.findAll({
      where: { status: 'in_progress' },
    });

    for (const transfer of staleInProgress) {
      await transfer.update({ status: 'pending', workerId: null, error: null });
      ensureActiveTransfer(transfer.raw());
    }

    const pendingTransfers = await Transfer.findAll({
      where: { status: 'pending' },
      order: [['createdAt', 'ASC']],
    });

    for (const transfer of pendingTransfers) {
      ensureActiveTransfer(transfer.raw());
    }

    queueHydrated = true;

    if (staleInProgress.length > 0 || pendingTransfers.length > 0) {
      console.log(
        `Transfer queue hydrated: pending=${pendingTransfers.length} requeuedInProgress=${staleInProgress.length}`,
      );
    }
  })();

  try {
    await queueHydrationPromise;
  } finally {
    queueHydrationPromise = null;
  }
}

export async function requeueTransferForRetry(
  transferId: string,
  reason: string,
): Promise<RawTransfer | null> {
  const transfer = await Transfer.findOne({ where: { id: transferId } });
  if (!transfer) {
    return null;
  }

  if (
    transfer.status === 'completed' ||
    transfer.status === 'failed' ||
    transfer.status === 'cancelled'
  ) {
    return null;
  }

  await transfer.update({
    status: 'pending',
    workerId: null,
    error: null,
  });

  const rawTransfer = transfer.raw();
  ensureActiveTransfer(rawTransfer);

  console.warn(`Requeued transfer ${transferId} for retry: ${reason}`);

  return rawTransfer;
}

export async function cancelTransfer(
  transferId: string,
  requesterEntityId: string,
): Promise<RawTransfer | null> {
  const transfer = await Transfer.findOne({ where: { id: transferId } });
  if (!transfer) {
    return null;
  }

  if (transfer.fromEntityId !== requesterEntityId) {
    throw new Error('Unauthorized to cancel this transfer');
  }

  if (transfer.status !== 'pending' && transfer.status !== 'in_progress') {
    throw new Error('Only pending or in-progress transfers can be cancelled');
  }

  for (const [ws, state] of authState.entries()) {
    if (state.currentTask?.id === transferId) {
      state.currentTaskCancelRequested = true;
      authState.set(ws, state);
      console.log(
        `${logPrefix(state)} sending transfer_cancel transferId=${transferId} to workerConnection=${state.connectionId} workerId=${state.workerId ?? 'unknown'}`,
      );
      sendJson(ws, {
        type: 'transfer_cancel',
        id: transferId,
        payload: { id: transferId },
      });
    }
  }

  await updateTransferStatus(transferId, 'cancelled', transfer.quantityTransferred);

  const rawTransfer = transfer.raw();
  activeTransfers = activeTransfers.filter((t) => t.id !== transferId);

  return rawTransfer;
}

export async function updateTransferStatus(
  transferId: string,
  status: TransferStatus,
  quantityTransferred?: number,
  errorReason?: string,
  itemMetadata?: { itemName?: string; itemDisplayName?: string },
): Promise<void> {
  const transfer = await Transfer.findOne({ where: { id: transferId } });
  if (!transfer) {
    return;
  }

  const currentStatus = transfer.status;
  const isPendingOrInProgress = currentStatus === 'pending' || currentStatus === 'in_progress';
  const isAlreadyCancelled = currentStatus === 'cancelled';

  if (status === 'in_progress' && !isPendingOrInProgress) {
    return;
  }

  if ((status === 'completed' || status === 'failed') && !isPendingOrInProgress) {
    return;
  }

  if (status === 'cancelled' && !isPendingOrInProgress && !isAlreadyCancelled) {
    return;
  }

  const updates: {
    status: TransferStatus;
    quantityTransferred?: number;
    error?: string;
    itemName?: string;
    itemDisplayName?: string;
  } = { status, quantityTransferred, error: errorReason };

  if (!transfer.itemName && itemMetadata?.itemName) {
    updates.itemName = itemMetadata.itemName;
  }

  if (!transfer.itemDisplayName && itemMetadata?.itemDisplayName) {
    updates.itemDisplayName = itemMetadata.itemDisplayName;
  }

  await transfer.update(updates);
  const updatedTransfer = transfer.raw();

  const localTransfer = activeTransfers.find((transfer) => transfer.id === transferId);
  if (localTransfer) {
    localTransfer.status = status;
    if (errorReason !== undefined) {
      localTransfer.error = errorReason;
    }
    if (quantityTransferred !== undefined) {
      localTransfer.quantityTransferred = quantityTransferred;
    }
    if (!localTransfer.itemName && updates.itemName) {
      localTransfer.itemName = updates.itemName;
    }
    if (!localTransfer.itemDisplayName && updates.itemDisplayName) {
      localTransfer.itemDisplayName = updates.itemDisplayName;
    }
  }

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    const removedTransfer = activeTransfers.find((transfer) => transfer.id === transferId);
    if (removedTransfer) {
      trackTransferFinished(removedTransfer.fromEntityId);
    }

    activeTransfers = activeTransfers.filter((transfer) => transfer.id !== transferId);
  }

  void broadcastTransferUpdate(updatedTransfer);
}

async function assignTransferToWorker(
  transfer: RawTransfer,
  ws: WebSocket,
  state: AuthState,
): Promise<void> {
  state.currentTask = transfer;
  state.currentTaskCancelRequested = false;
  authState.set(ws, state);

  if (state.workerId !== undefined) {
    transfer.workerId = state.workerId;

    try {
      await Transfer.update({ workerId: state.workerId }, { where: { id: transfer.id } });
    } catch (err) {
      console.error(`Failed to record worker ${state.workerId} for transfer ${transfer.id}:`, err);
    }
  }

  const fromEntity = await findEntityById(transfer.fromEntityId);
  const toEntity = await findEntityById(transfer.toEntityId);

  if (!fromEntity || !toEntity) {
    throw new Error(
      `Cannot assign transfer ${transfer.id}; one or more entities are missing or inactive`,
    );
  }

  console.log(
    `${logPrefix(state)} assigning transfer=${transfer.id} from=${transfer.fromEntityId} to=${transfer.toEntityId} workerId=${state.workerId ?? 'unknown'}`,
  );

  sendJson(ws, {
    type: 'transfer',
    payload: {
      id: transfer.id,
      from: [fromEntity.colorA, fromEntity.colorB, fromEntity.colorC],
      to: [toEntity.colorA, toEntity.colorB, toEntity.colorC],
      fromName: fromEntity.name,
      toName: toEntity.name,
      fromType: fromEntity.entityType,
      toType: toEntity.entityType,
      itemName: transfer.itemName,
      itemDisplayName: transfer.itemDisplayName,
      itemNbt: transfer.itemNbt,
      memo: transfer.memo,
      quantity: transfer.quantity,
      timeout: transfer.timeout,
    },
  });

  try {
    await updateTransferStatus(transfer.id, 'in_progress', transfer.quantityTransferred);
  } catch (err) {
    console.error(`Failed to process transfer ${transfer.id}:`, err);
  }
}

let processingTransfers = false;

export async function processTransfers(): Promise<void> {
  await initializeTransferQueue();

  if (processingTransfers) {
    return;
  }

  processingTransfers = true;
  try {
    const transfersToProcess = activeTransfers.filter((transfer) => transfer.status === 'pending');
    if (transfersToProcess.length === 0) {
      return;
    }

    console.log(`Processing ${transfersToProcess.length} pending transfers`);

    for (const transfer of transfersToProcess) {
      let assigned = false;

      for (const [ws, state] of authState.entries()) {
        if (!state.authenticated) {
          continue;
        }

        if (state.role !== 'worker') {
          continue;
        }

        if (state.currentTask?.id === transfer.id) {
          console.warn(`${logPrefix(state)} transfer already active transferId=${transfer.id}`);
          continue;
        }

        if (state.currentTask) {
          continue;
        }

        try {
          await assignTransferToWorker(transfer, ws, state);
          assigned = true;
          break;
        } catch (error) {
          console.error(`Failed to assign transfer ${transfer.id}:`, error);
        }
      }

      if (!assigned) {
        console.warn(
          `No available authenticated worker for transfer ${transfer.id}; will retry. connected=${authState.size} transfers=${transfersToProcess.length}`,
        );
      }
    }
  } finally {
    processingTransfers = false;
  }
}
