import { initWebSockets } from './server';
import { processTransfers, queueTransfer } from './transferQueue';

setInterval(processTransfers, 1000);

export { initWebSockets, queueTransfer };
