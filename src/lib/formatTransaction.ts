import { Transaction } from 'kromer';
import playerManager from './managers/playerManager';
import kromer from './kromer';
import { formatKromerBalance } from './formatKromer';

export interface RefundData {
  ref: string;
  type: string;
  original: string;
  message: string;
}

export interface TransactionData {
  from: string;
  to: string;
  entries: {
    error?: string;
    message?: string;
    blank?: string;
  };
  refund?: RefundData;
}

/**
 * Parses a structured metadata string like:
 * ref=33328;type=refund;original=88.1;message=Refund for transaction #33328
 */
export function parseStructuredMetadata(metadata: string): RefundData | null {
  if (!metadata || !metadata.includes('ref=') || !metadata.includes('type=')) {
    return null;
  }

  const parts = metadata.split(';');
  const parsed: Partial<RefundData> = {};

  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.substring(0, eqIndex).toLowerCase();
    const value = part.substring(eqIndex + 1);

    if (key === 'ref') parsed.ref = value;
    else if (key === 'type') parsed.type = value;
    else if (key === 'original') parsed.original = value;
    else if (key === 'message') parsed.message = value;
  }

  if (parsed.ref && parsed.type) {
    return parsed as RefundData;
  }

  return null;
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

  // Try to parse structured metadata (refund format)
  const refund = parseStructuredMetadata(transaction.metadata ?? '');

  return {
    from,
    to,
    entries: {
      error: errorEntry?.value,
      message: messageEntry?.value,
      blank: blankEntry?.name,
    },
    refund: refund ?? undefined,
  };
};

/**
 * Format refund data for in-game chat display
 */
export function formatRefundForChat(refund: RefundData): string {
  const typeLabel = refund.type.charAt(0).toUpperCase() + refund.type.slice(1);
  return `<gold>${typeLabel}</gold> <gray>for tx</gray> <white>#${refund.ref}</white>`;
}

/**
 * Format refund data for Discord display
 */
export function formatRefundForDiscord(refund: RefundData): string {
  const typeLabel = refund.type.charAt(0).toUpperCase() + refund.type.slice(1);
  let result = `\n> **${typeLabel}** for [#${refund.ref}](https://kromer.club/transactions/${refund.ref})`;
  if (refund.message) {
    result += `\n> *${refund.message}*`;
  }
  return result;
}

export default (transaction: Transaction, data?: TransactionData): string => {
  if (!data) {
    data = parseTransactionData(transaction);
  }

  let message = '';

  // Check for refund data first (more specific)
  if (data.refund) {
    message = formatRefundForChat(data.refund);
  } else if (data.entries.error) {
    message = `<dark_red>Error:</dark_red> <red>${data.entries.error}</red>`;
  } else if (data.entries.message) {
    message = `<blue>Message:</blue> <gray>${data.entries.message}</gray>`;
  } else if (data.entries.blank) {
    message = `<gray><italic>${data.entries.blank.substring(0, 16)}</italic></gray>`;
  }

  return (
    `<gray>${transaction.id.toLocaleString()}.</gray> ${data.from} <gray>-></gray> ` +
    `${data.to} <gray>|</gray> ` +
    `${formatKromerBalance(transaction.value)} ${message}`.trim()
  );
};
