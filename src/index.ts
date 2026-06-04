import 'dotenv/config';
import { createLogger } from './lib/logger';
import { startRequestLogRetentionJob } from './lib/requestLogRetention';

const log = createLogger('App');

// Handle uncaught exceptions to prevent crashes from library bugs
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection at:', promise, 'reason:', reason);
});

startRequestLogRetentionJob();

import('./chat');
import('./express');
import('./kromerWs');
import('./discord');
