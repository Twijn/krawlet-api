/**
 * Lightweight structured logger.
 *
 * Usage:
 *   import { createLogger } from '../lib/logger';
 *   const log = createLogger('MyModule');
 *   log.info('Server started on port 3000');
 *   log.error('Something broke', err);
 *   log.warn('Unexpected state');
 *   log.debug('Verbose detail');
 *
 * Output format:
 *   [2026-05-04 18:23:11] [MyModule] INFO  Server started on port 3000
 */

type LogLevel = 'DEBUG' | 'INFO ' | 'WARN ' | 'ERROR';

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function write(level: LogLevel, module: string, args: unknown[]): void {
  const prefix = `[${timestamp()}] [${module}] ${level}`;
  if (level === 'ERROR') {
    console.error(prefix, ...args);
  } else if (level === 'WARN ') {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

export interface Logger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

export function createLogger(module: string): Logger {
  return {
    info: (...args) => write('INFO ', module, args),
    error: (...args) => write('ERROR', module, args),
    warn: (...args) => write('WARN ', module, args),
    debug: (...args) => write('DEBUG', module, args),
  };
}
