import { Op } from 'sequelize';
import { RequestLog } from './models/requestlog.model';
import { createLogger } from './logger';

const log = createLogger('RequestLogRetention');

const DEFAULT_RETENTION_DAYS = 7;
const MIN_RETENTION_DAYS = 7;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DELETE_BATCH_SIZE = 10000;

let retentionJobStarted = false;

function getRetentionDays(): number {
  const rawValue = process.env.REQUEST_LOG_RETENTION_DAYS;

  if (!rawValue) {
    return DEFAULT_RETENTION_DAYS;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) {
    log.warn(
      `Invalid REQUEST_LOG_RETENTION_DAYS="${rawValue}". Using minimum/default ${MIN_RETENTION_DAYS} days.`,
    );
    return MIN_RETENTION_DAYS;
  }

  if (parsed < MIN_RETENTION_DAYS) {
    log.warn(
      `REQUEST_LOG_RETENTION_DAYS=${parsed} is below minimum. Using ${MIN_RETENTION_DAYS} days.`,
    );
    return MIN_RETENTION_DAYS;
  }

  return parsed;
}

async function cleanupOldRequestLogs(): Promise<void> {
  const retentionDays = getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  let totalDeleted = 0;

  while (true) {
    const deleted = await RequestLog.destroy({
      where: {
        timestamp: {
          [Op.lt]: cutoff,
        },
      },
      limit: DELETE_BATCH_SIZE,
    });

    totalDeleted += deleted;

    if (deleted < DELETE_BATCH_SIZE) {
      break;
    }
  }

  if (totalDeleted > 0) {
    log.info(`Deleted ${totalDeleted} request logs older than ${retentionDays} days.`);
  }
}

export function startRequestLogRetentionJob(): void {
  if (retentionJobStarted) {
    return;
  }

  retentionJobStarted = true;

  const retentionDays = getRetentionDays();
  log.info(
    `Request log retention enabled: ${retentionDays} days (minimum ${MIN_RETENTION_DAYS}). Cleanup every ${CLEANUP_INTERVAL_MS / (60 * 60 * 1000)} hours.`,
  );

  cleanupOldRequestLogs().catch((err) => {
    log.error('Failed to clean up request logs:', err);
  });

  setInterval(() => {
    cleanupOldRequestLogs().catch((err) => {
      log.error('Failed to clean up request logs:', err);
    });
  }, CLEANUP_INTERVAL_MS);
}
