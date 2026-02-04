import kromer from '../lib/kromer';
import playerManager from '../lib/managers/playerManager';
import { rcc } from '../chat';

import { hook } from '../lib/webhook';
import { Transaction, TransactionWithMeta } from 'kromer';
import { HATransactions } from '../lib/HATransactions';
import formatTransaction, {
  parseTransactionData,
  TransactionData,
  formatRefundForDiscord,
  formatKBCForDiscord,
  formatItemReturnForDiscord,
} from '../lib/formatTransaction';
import walletListeners from './walletListeners';
import { formatKromerBalance } from '../lib/formatKromer';

const STRIPPED_META_ENTRIES = [
  'error',
  'message',
  'return',
  'ref',
  'type',
  'original',
  'winner_ticket',
  'winner',
  'payout',
  'name',
  'quantity',
  'left',
];

/**
 * Sanitizes text for use inside Discord inline code blocks.
 * Backticks cannot be escaped inside code blocks, so we replace them.
 */
function sanitizeForInlineCode(text: string): string {
  return text.replace(/`/g, "'");
}

type Handler = (transaction: TransactionWithMeta, data: TransactionData) => void;

function transactionUrl(transaction: Transaction) {
  return `[#${transaction.id}](https://kromer.club/transactions/${transaction.id})`;
}

function addressUrl(address: string, label?: string) {
  if (!label) {
    label = address;
  } else if (label !== address) {
    label += ` (${address})`;
  }
  return `[${label}](https://kromer.club/addresses/${address})`;
}

function sendDiscordMessage(transaction: TransactionWithMeta, data: TransactionData) {
  let metadata = '';

  // Check for KBC data first (most specific, cleanest display)
  if (data.kbc) {
    metadata += formatKBCForDiscord(data.kbc);
  } else if (data.itemReturn) {
    // Check for item return data
    metadata += formatItemReturnForDiscord(data.itemReturn);
  } else if (data.refund) {
    // Check for refund data (more specific, cleaner display)
    metadata += formatRefundForDiscord(data.refund);
  } else {
    if (data.entries.error) {
      metadata += `\n> :x: *${data.entries.error}*`;
    }
    if (data.entries.message) {
      metadata += `\n> :speech_balloon: *${data.entries.message}*`;
    }

    let strippedEntries = transaction?.meta?.entries
      ? transaction.meta.entries.filter(
          (x) => !STRIPPED_META_ENTRIES.includes(x.name.toLowerCase()),
        )
      : [];
    if (strippedEntries.length > 0) {
      metadata +=
        '\n`' +
        sanitizeForInlineCode(
          strippedEntries.map((x) => `${x.name}${x.value ? `=${x.value}` : ''}`).join(';'),
        ) +
        '`';
    }
  }

  hook
    .batchedSend(
      `${transactionUrl(transaction)} | ${transaction.from ? addressUrl(transaction.from, data.from) : 'unknown'} -> ${addressUrl(transaction.to, data.to)} | ${formatKromerBalance(transaction.value)}${metadata}`,
    )
    .catch(console.error);
}

function sendInGameMessage(transaction: TransactionWithMeta, data: TransactionData) {
  let sentNames: string[] = [];

  playerManager.getNotifiedPlayers().forEach((player) => {
    const fromSelf = transaction.from === player.kromerAddress;
    const toSelf = transaction.to === player.kromerAddress;
    if (
      player.notifications === 'all' ||
      (player.notifications === 'self' && (fromSelf || toSelf))
    ) {
      rcc
        .tell(
          player.minecraftName,
          `<gray>New transaction:</gray>\n ${formatTransaction(transaction, data)}`,
        )
        .catch(console.error);
      sentNames.push(player.minecraftName);
    }
  });

  if (sentNames.length > 0) {
    console.log(`Sent transaction (${transaction.id}) notifications to ${sentNames.join(', ')}`);
  }
}

const handlers: Handler[] = [sendDiscordMessage, sendInGameMessage];

const haTransactions = new HATransactions(kromer);

haTransactions.on((transaction: TransactionWithMeta) => {
  const data = parseTransactionData(transaction);
  handlers.forEach((handler) => {
    try {
      handler(transaction, data);
    } catch (error) {
      console.error('Error in transaction handler:', error);
    }
  });
});

export const KRAWLET_PRIVATE_KEY = process.env.KRAWLET_PKEY ?? 'test';
export const krawletAddress = kromer.addresses.decodeAddressFromPrivateKey(KRAWLET_PRIVATE_KEY);

console.log(`Listening for transactions to: ${krawletAddress}`);

haTransactions.on(async (transaction: TransactionWithMeta) => {
  if (transaction.to !== krawletAddress || transaction.type !== 'transfer' || !transaction.from)
    return;

  console.log(
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

        if (!transaction.meta?.entries.find((x) => ['message', 'error'].includes(x.name))) {
          // Transaction was not detected as an automatic refund from Krawlet's transaction
          // Refund the transaction!

          console.log(`Sending ${type} to ${transaction.from}: ${message}`);

          await kromer.transactions.send({
            privatekey: KRAWLET_PRIVATE_KEY,
            to: transaction.from,
            amount: transaction.value,
            metadata: `${type}=${message}`,
          });
        } else {
          console.error(
            `Failed to refund ${transaction.from} ${formatKromerBalance(transaction.value)}`,
          );
        }

        return;
      }
    } catch (e) {
      console.error(e);
      return;
    }
  }

  console.log(`Sending [Unknown Operation] to ${transaction.from}`);

  try {
    await kromer.transactions.send({
      privatekey: KRAWLET_PRIVATE_KEY,
      to: transaction.from,
      amount: transaction.value,
      metadata: 'error=Unknown operation!',
    });
  } catch (e) {
    console.error(e);
  }
});

export default haTransactions;
