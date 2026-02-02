import { KromerApi, TransactionWithMeta } from 'kromer';

export type TransactionHandler = (transaction: TransactionWithMeta) => Promise<void> | void;

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface HATransactionsStatus {
  status: ConnectionStatus;
  lastError?: string;
  lastConnectedAt?: Date;
  lastTransactionId: number | null;
}

export class HATransactions {
  private client = this.api.createWsClient(undefined, ['transactions']);
  private lastTransactionId: number | null = null;
  private transactionHandlers: TransactionHandler[] = [];
  private isCheckingTransactions = false;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private lastError?: string;
  private lastConnectedAt?: Date;

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

    this.client.connect().catch((err) => {
      console.error('Failed to connect to Kromer WS:', err);
      this.connectionStatus = 'error';
      this.lastError = err?.message || 'Failed to connect';
    });

    this.retrieveLatestTransaction().catch(console.error);

    setInterval(() => {
      this.checkForTransactions().catch(console.error);
    }, queryInterval);
  }

  private handleReady() {
    console.log('Connected to Kromer WS!');
    this.connectionStatus = 'connected';
    this.lastConnectedAt = new Date();
    this.lastError = undefined;
  }

  private handleError(e: Event | Error) {
    console.error('Kromer WS error:', e);
    this.connectionStatus = 'error';
    this.lastError = e instanceof Error ? e.message : 'WebSocket error';
  }

  private handleClose() {
    console.log('Kromer WS connection closed');
    this.connectionStatus = 'disconnected';
  }

  private async handleTransaction(transaction: TransactionWithMeta) {
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
    };
  }
}
