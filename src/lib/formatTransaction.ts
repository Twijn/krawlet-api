import { Transaction } from 'kromer';
import playerManager from './managers/playerManager';
import kromer from './kromer';

export interface TransactionData {
  from: string;
  to: string;
  entries: {
    error?: string;
    message?: string;
    blank?: string;
  };
}

export const parseTransactionData = (transaction: Transaction): TransactionData => {
  let from = transaction.from ?? 'unknown';
  let to = transaction.to;

  const fromPlayer = playerManager.getPlayerFromAddress(from);
  const toPlayer = playerManager.getPlayerFromAddress(to);

  if (fromPlayer) {
    from = fromPlayer.minecraftName;
  }
  if (toPlayer) {
    to = toPlayer?.minecraftName;
  }

  const meta = kromer.transactions.parseMetadata(transaction);
  const errorEntry = meta.entries?.find((x) => x.name.toLowerCase() === 'error');
  const messageEntry = meta.entries?.find((x) => x.name.toLowerCase() === 'message');
  const blankEntry = meta.entries?.find((x) => !x.value);

  return {
    from,
    to,
    entries: {
      error: errorEntry?.value,
      message: messageEntry?.value,
      blank: blankEntry?.name,
    },
  };
};

export default (transaction: Transaction, data?: TransactionData): string => {
  if (!data) {
    data = parseTransactionData(transaction);
  }

  let message = '';

  if (data.entries.error) {
    message = `<dark_red>Error:</dark_red> <red>${data.entries.error}</red>`;
  } else if (data.entries.message) {
    message = `<blue>Message:</blue> <gray>${data.entries.message}</gray>`;
  } else if (data.entries.blank) {
    message = `<gray><italic>${data.entries.blank.substring(0, 16)}</italic></gray>`;
  }

  return (
    `<gray>${transaction.id.toLocaleString()}.</gray> ${data.from} <gray>-></gray> ` +
    `${data.to} <gray>|</gray> ` +
    `${transaction.value.toFixed(2)} <gray>KRO</gray> ${message}`.trim()
  );
};
