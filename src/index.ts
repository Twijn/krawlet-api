import { config } from 'dotenv';
import { createLogger } from './lib/logger';

const log = createLogger('App');
config();

// Handle uncaught exceptions to prevent crashes from library bugs
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection at:', promise, 'reason:', reason);
});

import('./chat');
import('./express');
import('./kromerWs');
import('./discord');
