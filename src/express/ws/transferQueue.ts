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

export async function queueTransfer(
  from: { uuid: string; name: string },
  to: string,
  itemName?: string,
  quantity?: number,
): Promise<RawTransfer> {
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

  const transfer = await Transfer.create(
    {
      fromUUID: from.uuid,
      fromUsername: from.name,
      toUUID: toPlayer.minecraftUUID,
      toUsername: toPlayer.minecraftName,
      itemName,
      quantity,
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

  if (transfer.status !== 'pending') {
    throw new Error('Only pending transfers can be cancelled');
  }

  for (const [ws, state] of authState.entries()) {
    if (state.currentTask?.id === transferId) {
      state.currentTask = null;
      authState.set(ws, state);
      sendJson(ws, { type: 'cancelled', payload: { id: transferId } });
    }
  }

  await transfer.update({ status: 'cancelled' });

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
  await Transfer.update(
    { status, quantityTransferred, error: errorReason },
    { where: { id: transferId } },
  );

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

  if (status === 'completed' || status === 'failed') {
    activeTransfers = activeTransfers.filter((transfer) => transfer.id !== transferId);
  }
}

async function assignTransferToWorker(
  transfer: RawTransfer,
  ws: WebSocket,
  state: AuthState,
): Promise<void> {
  state.currentTask = transfer;
  authState.set(ws, state);

  const playerOne = await resolvePlayer(transfer.fromUUID);
  const playerTwo = await resolvePlayer(transfer.toUUID);

  console.log(
    `${logPrefix(state)} assigning transfer=${transfer.id} from=${transfer.fromUUID} to=${transfer.toUUID}`,
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
