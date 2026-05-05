import { initWebSockets } from './server';
import {
  initializeTransferQueue,
  processTransfers,
  queueTransfer,
  queueTransferByEntities,
} from './transferQueue';
import { queryWorkerStorage } from './storageQuery';
import { createLogger } from '../../lib/logger';

const log = createLogger('WS');

void initializeTransferQueue().catch((err) => {
  log.error('Failed to hydrate transfer queue on startup:', err);
});

setInterval(processTransfers, 1000);

export { initWebSockets, queueTransfer, queueTransferByEntities, queryWorkerStorage };
