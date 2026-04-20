import { ApiKeyTier } from '../../lib/models/apikey.model';

const DEFAULT_MAX_CONCURRENT_WORKERS = 3;

const workerLimitOverrides: Partial<Record<ApiKeyTier, number>> = {};

const activeTransfersByUuid = new Map<string, number>();
const activeStorageQueriesByUuid = new Map<string, number>();
const reservedWorkerSlotsByUuid = new Map<string, number>();

function incrementCounter(counter: Map<string, number>, uuid: string): void {
  counter.set(uuid, (counter.get(uuid) ?? 0) + 1);
}

function decrementCounter(counter: Map<string, number>, uuid: string): void {
  const nextValue = (counter.get(uuid) ?? 0) - 1;

  if (nextValue > 0) {
    counter.set(uuid, nextValue);
    return;
  }

  counter.delete(uuid);
}

export class WorkerLimitExceededError extends Error {
  public readonly code = 'WORKER_LIMIT_REACHED';

  constructor(public readonly limit: number) {
    super(`A maximum of ${limit} concurrent worker jobs is allowed for this Minecraft user`);
    this.name = 'WorkerLimitExceededError';
  }
}

export function getMaxConcurrentWorkersForTier(tier?: ApiKeyTier): number {
  if (!tier) {
    return DEFAULT_MAX_CONCURRENT_WORKERS;
  }

  return workerLimitOverrides[tier] ?? DEFAULT_MAX_CONCURRENT_WORKERS;
}

export function getActiveWorkerUsage(uuid: string): number {
  return (activeTransfersByUuid.get(uuid) ?? 0) + (activeStorageQueriesByUuid.get(uuid) ?? 0);
}

export function reserveWorkerSlot(uuid: string, tier?: ApiKeyTier): () => void {
  const limit = getMaxConcurrentWorkersForTier(tier);
  const activeUsage = getActiveWorkerUsage(uuid);
  const reservedUsage = reservedWorkerSlotsByUuid.get(uuid) ?? 0;

  if (activeUsage + reservedUsage >= limit) {
    throw new WorkerLimitExceededError(limit);
  }

  incrementCounter(reservedWorkerSlotsByUuid, uuid);

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    decrementCounter(reservedWorkerSlotsByUuid, uuid);
  };
}

export function trackTransferStarted(uuid: string): void {
  incrementCounter(activeTransfersByUuid, uuid);
}

export function trackTransferFinished(uuid: string): void {
  decrementCounter(activeTransfersByUuid, uuid);
}

export function trackStorageQueryStarted(uuid: string): void {
  incrementCounter(activeStorageQueriesByUuid, uuid);
}

export function trackStorageQueryFinished(uuid: string): void {
  decrementCounter(activeStorageQueriesByUuid, uuid);
}
