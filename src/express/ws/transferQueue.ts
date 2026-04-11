import { WebSocket } from 'ws';
import { Player, RawTransfer, Transfer, TransferStatus } from '../../lib/models';
import { logPrefix, sendJson } from './protocol';
import { authState } from './state';
import { AuthState } from './types';

const resolvePlayerCache = new Map<string, Player>();

async function resolvePlayer(nameOrUUID: string): Promise<Player | null> {
  if (resolvePlayerCache.has(nameOrUUID)) {
    return resolvePlayerCache.get(nameOrUUID)!;
  }

  let player = await Player.findOne({ where: { minecraftUUID: nameOrUUID } });
  if (player) {
    resolvePlayerCache.set(nameOrUUID, player);
    return player;
  }

  player = await Player.findOne({ where: { minecraftName: nameOrUUID } });
  if (player) {
    resolvePlayerCache.set(nameOrUUID, player);
    return player;
  }

  return null;
}

let activeTransfers: RawTransfer[] = [];

export type QueueTransferParams = {
  from: { uuid: string; name: string };
  to: string;
  itemName?: string;
  quantity?: number;
  timeout?: number;
};

export async function queueTransfer(params: QueueTransferParams): Promise<RawTransfer> {
  const { from, to, itemName, quantity, timeout } = params;
  const fromPlayer = await resolvePlayer(from.uuid);
  const toPlayer = await resolvePlayer(to);

  if (!fromPlayer) {
    throw new Error(`Player not found: ${from.uuid}`);
  }

  if (!fromPlayer.estorageColorA || !fromPlayer.estorageColorB || !fromPlayer.estorageColorC) {
    throw new Error(`Player is missing estorage color data: ${from.uuid}`);
  }

  if (!toPlayer) {
    throw new Error(`Player not found: ${to}`);
  }

  if (!toPlayer.estorageColorA || !toPlayer.estorageColorB || !toPlayer.estorageColorC) {
    throw new Error(`Player is missing estorage color data: ${to}`);
  }

  if (toPlayer.minecraftUUID === from.uuid) {
    throw new Error('Cannot transfer to the same player');
  }

  if (timeout) {
    if (timeout < 0) {
      throw new Error('Timeout must be a positive number');
    } else if (timeout > 30) {
      throw new Error('Timeout cannot exceed 30 seconds');
    }
  }

  const transfer = await Transfer.create(
    {
      fromUUID: from.uuid,
      fromUsername: from.name,
      toUUID: toPlayer.minecraftUUID,
      toUsername: toPlayer.minecraftName,
      itemName,
      quantity,
      timeout,
    },
    {
      returning: true,
    },
  );

  const rawTransfer = transfer.raw();
  activeTransfers.push(rawTransfer);

  return rawTransfer;
}

export async function cancelTransfer(
  transferId: string,
  requesterUUID: string,
): Promise<RawTransfer | null> {
  const transfer = await Transfer.findOne({ where: { id: transferId } });
  if (!transfer) {
    return null;
  }

  if (transfer.fromUUID !== requesterUUID) {
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

  await transfer.update({ status, quantityTransferred, error: errorReason });

  const localTransfer = activeTransfers.find((transfer) => transfer.id === transferId);
  if (localTransfer) {
    localTransfer.status = status;
    if (errorReason !== undefined) {
      localTransfer.error = errorReason;
    }
    if (quantityTransferred !== undefined) {
      localTransfer.quantityTransferred = quantityTransferred;
    }
  }

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    activeTransfers = activeTransfers.filter((transfer) => transfer.id !== transferId);
  }
}

async function assignTransferToWorker(
  transfer: RawTransfer,
  ws: WebSocket,
  state: AuthState,
): Promise<void> {
  state.currentTask = transfer;
  state.currentTaskCancelRequested = false;
  authState.set(ws, state);

  const playerOne = await resolvePlayer(transfer.fromUUID);
  const playerTwo = await resolvePlayer(transfer.toUUID);

  console.log(
    `${logPrefix(state)} assigning transfer=${transfer.id} from=${transfer.fromUUID} to=${transfer.toUUID} workerid=${state.workerId ?? 'unknown'}`,
  );

  sendJson(ws, {
    type: 'transfer',
    payload: {
      id: transfer.id,
      from: [playerOne?.estorageColorA, playerOne?.estorageColorB, playerOne?.estorageColorC],
      to: [playerTwo?.estorageColorA, playerTwo?.estorageColorB, playerTwo?.estorageColorC],
      itemName: transfer.itemName,
      quantity: transfer.quantity,
    },
  });

  try {
    await updateTransferStatus(transfer.id, 'in_progress');
  } catch (err) {
    console.error(`Failed to process transfer ${transfer.id}:`, err);
  }
}

let processingTransfers = false;

export async function processTransfers(): Promise<void> {
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

        if (state.currentTask?.id === transfer.id) {
          console.warn(`${logPrefix(state)} transfer already active transferId=${transfer.id}`);
          continue;
        }

        if (state.currentTask) {
          continue;
        }

        await assignTransferToWorker(transfer, ws, state);
        assigned = true;
        break;
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
