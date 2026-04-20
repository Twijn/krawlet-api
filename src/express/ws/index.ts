import { initWebSockets } from './server';
import {
  initializeTransferQueue,
  processTransfers,
  queueTransfer,
  queueTransferByEntities,
} from './transferQueue';
import { queryWorkerStorage } from './storageQuery';

void initializeTransferQueue().catch((err) => {
  console.error('Failed to hydrate transfer queue on startup:', err);
});

setInterval(processTransfers, 1000);

export { initWebSockets, queueTransfer, queueTransferByEntities, queryWorkerStorage };
