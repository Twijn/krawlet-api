import { KromerApi, TransactionWithMeta } from 'kromer';

export type TransactionHandler = (transaction: TransactionWithMeta) => Promise<void> | void;

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'down';

export interface HATransactionsStatus {
  status: ConnectionStatus;
  lastError?: string;
  lastConnectedAt?: Date;
  lastTransactionId: number | null;
  failedAttempts?: number;
  nextReconnectAt?: Date;
}

// Configuration for reconnection behavior
const RECONNECT_CONFIG = {
  maxFailedAttempts: 5, // Number of failures before entering "down" state
  normalRetryDelay: 5_000, // 5 seconds for normal reconnect
  downRetryDelay: 60_000, // 60 seconds when in "down" state
  maxDownRetryDelay: 300_000, // 5 minutes max delay when in "down" state
};

export class HATransactions {
  private client = this.api.createWsClient(undefined, ['transactions']);
  private lastTransactionId: number | null = null;
  private transactionHandlers: TransactionHandler[] = [];
  private isCheckingTransactions = false;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private lastError?: string;
  private lastConnectedAt?: Date;
  private failedAttempts = 0;
  private reconnectTimeout?: NodeJS.Timeout;
  private nextReconnectAt?: Date;
  private processedTransactions = new Set<number>();
  private readonly MAX_PROCESSED_CACHE = 1000; // Track last 1000 transaction IDs

  private async retrieveLatestTransaction() {
    try {
      const { transactions } = await this.api.transactions.getLatest({
        limit: 1,
      });

      if (transactions.length > 0) {
        this.lastTransactionId = transactions[0].id;
      }
    } catch (e) {
      console.error(e);
    }
  }

  private async checkForTransactions() {
    if (this.isCheckingTransactions) return;
    this.isCheckingTransactions = true;

    try {
      if (this.lastTransactionId === null) {
        await this.retrieveLatestTransaction();
        return;
      }

      const transactions = await this.api.transactions.getLatest({
        limit: 20,
      });

      for (const transaction of transactions.transactions.reverse()) {
        if (transaction.type === 'transfer' && transaction.id > this.lastTransactionId) {
          await this.handleTransaction({
            ...transaction,
            meta: this.api.transactions.parseMetadata(transaction),
          } as TransactionWithMeta);
        }
      }
    } finally {
      this.isCheckingTransactions = false;
    }
  }

  constructor(
    private api: KromerApi,
    queryInterval: number = 10_000,
  ) {
    console.log('Starting HATransactions with query interval of ' + queryInterval + 'ms');
    this.connectionStatus = 'connecting';
    this.client.on('ready', this.handleReady.bind(this));
    this.client.on('error', this.handleError.bind(this));
    this.client.on('transaction', this.handleTransaction.bind(this));
    this.client.on('close', this.handleClose.bind(this));

    this.attemptConnect();

    this.retrieveLatestTransaction().catch(console.error);

    setInterval(() => {
      this.checkForTransactions().catch(console.error);
    }, queryInterval);
  }

  private attemptConnect() {
    this.connectionStatus = 'connecting';
    this.client.connect().catch((err) => {
      console.error('Failed to connect to Kromer WS:', err);
      this.handleConnectionFailure(err?.message || 'Failed to connect');
    });
  }

  private handleConnectionFailure(errorMessage: string) {
    this.failedAttempts++;
    this.lastError = errorMessage;

    if (this.failedAttempts >= RECONNECT_CONFIG.maxFailedAttempts) {
      this.connectionStatus = 'down';
      // Calculate delay with exponential backoff, capped at maxDownRetryDelay
      const backoffMultiplier = Math.min(
        this.failedAttempts - RECONNECT_CONFIG.maxFailedAttempts + 1,
        5,
      );
      const delay = Math.min(
        RECONNECT_CONFIG.downRetryDelay * backoffMultiplier,
        RECONNECT_CONFIG.maxDownRetryDelay,
      );
      console.log(
        `Kromer WS in DOWN state after ${this.failedAttempts} failed attempts. Retrying in ${delay / 1000}s`,
      );
      this.scheduleReconnect(delay);
    } else {
      this.connectionStatus = 'error';
      console.log(
        `Kromer WS connection failed (attempt ${this.failedAttempts}/${RECONNECT_CONFIG.maxFailedAttempts}). Retrying in ${RECONNECT_CONFIG.normalRetryDelay / 1000}s`,
      );
      this.scheduleReconnect(RECONNECT_CONFIG.normalRetryDelay);
    }
  }

  private scheduleReconnect(delay: number) {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.nextReconnectAt = new Date(Date.now() + delay);

    this.reconnectTimeout = setTimeout(() => {
      console.log('Attempting to reconnect to Kromer WS...');
      this.attemptConnect();
    }, delay);
  }

  private handleReady() {
    console.log('Connected to Kromer WS!');
    this.connectionStatus = 'connected';
    this.lastConnectedAt = new Date();
    this.lastError = undefined;
    this.failedAttempts = 0; // Reset failed attempts on successful connection
    this.nextReconnectAt = undefined;
  }

  private handleError(e: Event | Error) {
    console.error('Kromer WS error:', e);
    const errorMessage = e instanceof Error ? e.message : 'WebSocket error';
    this.handleConnectionFailure(errorMessage);
  }

  private handleClose() {
    console.log('Kromer WS connection closed');
    // Only schedule reconnect if we're not already in a reconnecting state
    if (this.connectionStatus === 'connected') {
      this.handleConnectionFailure('Connection closed');
    }
  }

  private async handleTransaction(transaction: TransactionWithMeta) {
    // Skip if we've already processed this transaction (prevents duplicates from WS + polling)
    if (this.processedTransactions.has(transaction.id)) {
      return;
    }

    // Mark as processed
    this.processedTransactions.add(transaction.id);

    // Trim the cache if it gets too large (keep most recent transactions)
    if (this.processedTransactions.size > this.MAX_PROCESSED_CACHE) {
      const sortedIds = Array.from(this.processedTransactions).sort((a, b) => a - b);
      const toRemove = sortedIds.slice(
        0,
        this.processedTransactions.size - this.MAX_PROCESSED_CACHE,
      );
      toRemove.forEach((id) => this.processedTransactions.delete(id));
    }

    this.lastTransactionId = transaction.id;
    for (const handler of this.transactionHandlers) {
      try {
        await handler(transaction);
      } catch (e) {
        console.error(e);
      }
    }
  }

  on(handler: TransactionHandler) {
    this.transactionHandlers.push(handler);
  }

  getStatus(): HATransactionsStatus {
    return {
      status: this.connectionStatus,
      lastError: this.lastError,
      lastConnectedAt: this.lastConnectedAt,
      lastTransactionId: this.lastTransactionId,
      failedAttempts: this.failedAttempts > 0 ? this.failedAttempts : undefined,
      nextReconnectAt: this.nextReconnectAt,
    };
  }
}
