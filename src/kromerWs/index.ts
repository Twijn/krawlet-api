import type { TransactionWithMeta } from 'kromer';
import kromer from '#lib/kromer';
import { HATransactions } from '#lib/HATransactions';
import { parseTransactionData } from '#lib/formatTransaction';
import { formatKromerBalance } from '#lib/formatKromer';
import { createLogger } from '#lib/logger';
import { Handler } from '#lib/types';
import walletListeners from './walletListeners';
import { queueDiscordMessage } from './handlers/discord';
import { sendInGameMessage } from './handlers/inGame';

const log = createLogger('KromerWs');

const handlers: Handler[] = [queueDiscordMessage, sendInGameMessage];

const haTransactions = new HATransactions(kromer);

haTransactions.on(async (transaction: TransactionWithMeta) => {
  const data = await parseTransactionData(transaction);
  handlers.forEach((handler) => {
    try {
      handler(transaction, data);
    } catch (error) {
      log.error('Error in transaction handler:', error);
    }
  });
});

export const KRAWLET_PRIVATE_KEY = process.env.KRAWLET_PKEY ?? 'test';
export const krawletAddress = kromer.addresses.decodeAddressFromPrivateKey(KRAWLET_PRIVATE_KEY);

log.info(`Listening for transactions to: ${krawletAddress}`);

haTransactions.on(async (transaction: TransactionWithMeta) => {
  if (transaction.to !== krawletAddress || transaction.type !== 'transfer' || !transaction.from)
    return;

  log.info(
    `Received transaction from ${transaction.from}: ${transaction.metadata ?? 'no metadata'}`,
  );
  for (const listener of walletListeners) {
    try {
      const result = await listener(transaction as TransactionWithMeta & { from: string });

      if (result) {
        if (result.ignore) {
          continue;
        }

        const type = result.success ? 'message' : 'error';
        const message = result.message || 'No message provided';

        if (
          !transaction.meta?.entries.find((x) =>
            ['message', 'error', 'msg', 'error'].includes(x.name.toLowerCase()),
          )
        ) {
          // Transaction was not detected as an automatic refund from Krawlet's transaction
          // Refund the transaction!

          log.info(`Sending ${type} to ${transaction.from}: ${message}`);

          await kromer.transactions.send({
            privatekey: KRAWLET_PRIVATE_KEY,
            to: transaction.from,
            amount: transaction.value,
            metadata: `${type}=${message}`,
          });
        } else {
          log.error(
            `Failed to refund ${transaction.from} ${formatKromerBalance(transaction.value)}`,
          );
        }

        return;
      }
    } catch (e) {
      log.error(e);
      return;
    }
  }

  log.info(`Sending [Unknown Operation] to ${transaction.from}`);

  try {
    await kromer.transactions.send({
      privatekey: KRAWLET_PRIVATE_KEY,
      to: transaction.from,
      amount: transaction.value,
      metadata: 'error=Unknown operation!',
    });
  } catch (e) {
    log.error(e);
  }
});

export default haTransactions;
