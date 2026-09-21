import { addressUrl, formatTransactionForDiscord, TransactionData } from '#lib/formatTransaction';
import { createLogger } from '#lib/logger';
import { hook } from '#lib/webhook';
import type { TransactionWithMeta } from 'kromer';

const log = createLogger('DiscordHandler');

const DISCORD_SEND_FREQUENCY = 5_000; // 5 seconds
const AUTO_OMIT_TRANSACTION_COUNT = 10; // omit all pending transactions from a single address after this count has been queued in the above frequency

type QueuedTransaction = {
  transaction: TransactionWithMeta;
  data: TransactionData;
  omitted: boolean;
};

let queuedTransactions: QueuedTransaction[] = [];

export function queueDiscordMessage(transaction: TransactionWithMeta, data: TransactionData) {
  queuedTransactions.push({
    transaction,
    data,
    // omit transactions with 'hide' entry set to 'true'
    omitted:
      transaction.meta?.entries.some(
        (e) => e.name.toLowerCase() === 'hide' && e.value.toLowerCase() == 'true',
      ) ?? false,
  });
}

function getAddressCounts(
  transactionList: QueuedTransaction[],
  includeOmitted: boolean = false,
): Map<string, number> {
  const addressCounts = new Map<string, number>();

  for (const { transaction, omitted } of transactionList) {
    if (!transaction.from) continue;
    if (omitted && !includeOmitted) continue;
    addressCounts.set(transaction.from, (addressCounts.get(transaction.from) ?? 0) + 1);
  }

  return addressCounts;
}

function omitOffendingAddresses() {
  const addressCounts = getAddressCounts(queuedTransactions);

  const offenders = new Set(
    [...addressCounts.entries()]
      .filter(([, count]) => count > AUTO_OMIT_TRANSACTION_COUNT)
      .map(([address]) => address),
  );

  if (offenders.size === 0) return;

  queuedTransactions = queuedTransactions.map((t) =>
    t.transaction.from && offenders.has(t.transaction.from) ? { ...t, omitted: true } : t,
  );
}

async function sendQueuedTransactions() {
  omitOffendingAddresses();

  let message = '';

  // Filter and append non-omitted messages
  const filteredTransactions = queuedTransactions.filter((t) => !t.omitted);

  const transactionIds: number[] = [];

  for (const { transaction, data } of filteredTransactions) {
    const formattedTransaction = formatTransactionForDiscord(transaction, data);
    if (message.length + formattedTransaction.length > 1950) break;
    message += '\n' + formattedTransaction;
    transactionIds.push(transaction.id);
  }

  // Build omitted transactions message
  const omittedTransactions = queuedTransactions.filter((t) => t.omitted);

  if (omittedTransactions.length > 0) {
    const omittedCount = omittedTransactions.length;
    const omittedAddressCounts = getAddressCounts(omittedTransactions, true);

    message += `\n-# ${omittedCount} transaction${omittedCount !== 1 ? 's' : ''} omitted. Sending address${omittedAddressCounts.size !== 1 ? 'es' : ''}: `;
    message += [...omittedAddressCounts.entries()]
      .map(([k, v]) => `${addressUrl(k)}${omittedAddressCounts.size !== 1 ? ` (${v})` : ''}`)
      .join(', ');
  }

  try {
    if (message) {
      await hook.send(message.trim());
      queuedTransactions = queuedTransactions.filter(
        (t) => !t.omitted && !transactionIds.includes(t.transaction.id),
      );
    }
  } catch (err) {
    log.error(err);
  }
}

setInterval(sendQueuedTransactions, DISCORD_SEND_FREQUENCY);
