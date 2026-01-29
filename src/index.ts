import { config } from 'dotenv';
config();

// Handle uncaught exceptions to prevent crashes from library bugs
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

import('./chat');
import('./express');
import('./kromerWs');
import('./discord');
