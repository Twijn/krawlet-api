import { Transaction } from 'kromer';
import playerManager from './managers/playerManager';
import kromer from './kromer';
import { formatKromerBalance } from './formatKromer';
import { getKnownAddresses } from './models/knownaddress.model';

export interface RefundData {
  ref: string;
  type: string;
  original: string;
  message: string;
}

export interface KBCData {
  round: string;
  winnerTicket: string;
  winner: string;
  payout: string;
}

export interface ItemReturnData {
  name: string;
  quantity: string;
  left: string;
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
  kbc?: KBCData;
  itemReturn?: ItemReturnData;
}

/**
 * Looks up a known address by its address string and returns its name if found.
 */
export function getKnownAddressName(address: string): string | null {
  const knownAddresses = getKnownAddresses();
  const knownAddress = knownAddresses.find((ka) => ka.address === address);
  return knownAddress ? knownAddress.name : null;
}

/**
 * Parses KBC (Kromer Ball Championship) metadata like:
 * KBC#6;winner_ticket=32;winner=Twijn;payout=126
 */
export function parseKBCMetadata(metadata: string): KBCData | null {
  if (!metadata || !metadata.startsWith('KBC#')) {
    return null;
  }

  const parts = metadata.split(';');
  const parsed: Partial<KBCData> = {};

  // First part is the round (KBC#6)
  const roundMatch = parts[0].match(/^KBC#(\d+)$/);
  if (roundMatch) {
    parsed.round = roundMatch[1];
  } else {
    return null;
  }

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.substring(0, eqIndex).toLowerCase();
    const value = part.substring(eqIndex + 1);

    if (key === 'winner_ticket') parsed.winnerTicket = value;
    else if (key === 'winner') parsed.winner = value;
    else if (key === 'payout') parsed.payout = value;
  }

  if (parsed.round && parsed.winner && parsed.payout) {
    return parsed as KBCData;
  }

  return null;
}

/**
 * Parses item return metadata like:
 * type=return;name=Shulker;quantity=1;left=0
 */
export function parseItemReturnMetadata(metadata: string): ItemReturnData | null {
  if (!metadata || !metadata.includes('type=return')) {
    return null;
  }

  const parts = metadata.split(';');
  const parsed: Partial<ItemReturnData> = {};

  for (const part of parts) {
    const eqIndex = part.indexOf('=');
    if (eqIndex === -1) continue;
    const key = part.substring(0, eqIndex).toLowerCase();
    const value = part.substring(eqIndex + 1);

    if (key === 'name') parsed.name = value;
    else if (key === 'quantity') parsed.quantity = value;
    else if (key === 'left') parsed.left = value;
  }

  if (parsed.name && parsed.quantity !== undefined) {
    return parsed as ItemReturnData;
  }

  return null;
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

  // Try player names first, then known addresses
  if (fromPlayer) {
    from = fromPlayer.minecraftName;
  } else if (transaction.from) {
    const knownName = getKnownAddressName(transaction.from);
    if (knownName) {
      from = knownName;
    }
  }

  if (toPlayer) {
    to = toPlayer.minecraftName;
  } else {
    const knownName = getKnownAddressName(transaction.to);
    if (knownName) {
      to = knownName;
    }
  }

  const meta = kromer.transactions.parseMetadata(transaction);
  const errorEntry = meta.entries?.find((x) => x.name.toLowerCase() === 'error');
  const messageEntry = meta.entries?.find((x) => x.name.toLowerCase() === 'message');
  const blankEntry = meta.entries?.find((x) => !x.value);

  // Try to parse structured metadata (refund format)
  const refund = parseStructuredMetadata(transaction.metadata ?? '');

  // Try to parse KBC metadata
  const kbc = parseKBCMetadata(transaction.metadata ?? '');

  // Try to parse item return metadata
  const itemReturn = parseItemReturnMetadata(transaction.metadata ?? '');

  return {
    from,
    to,
    entries: {
      error: errorEntry?.value,
      message: messageEntry?.value,
      blank: blankEntry?.name,
    },
    refund: refund ?? undefined,
    kbc: kbc ?? undefined,
    itemReturn: itemReturn ?? undefined,
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

/**
 * Format KBC (Kromer Ball Championship) data for in-game chat display
 */
export function formatKBCForChat(kbc: KBCData): string {
  return `<gold>KBC Round #${kbc.round}</gold> <gray>|</gray> <green>Winner:</green> <white>${kbc.winner}</white> <gray>(ticket #${kbc.winnerTicket})</gray>`;
}

/**
 * Format KBC (Kromer Ball Championship) data for Discord display
 */
export function formatKBCForDiscord(kbc: KBCData): string {
  return `\n> **Kromer Ball Round #${kbc.round}**\n> Winner: **${kbc.winner}** (ticket #${kbc.winnerTicket})`;
}

/**
 * Format item return data for in-game chat display
 */
export function formatItemReturnForChat(itemReturn: ItemReturnData): string {
  const leftText = itemReturn.left !== undefined ? ` <gray>(${itemReturn.left} left)</gray>` : '';
  return `<aqua>Item Return:</aqua> <white>${itemReturn.quantity}x ${itemReturn.name}</white>${leftText}`;
}

/**
 * Format item return data for Discord display
 */
export function formatItemReturnForDiscord(itemReturn: ItemReturnData): string {
  const leftText = itemReturn.left !== undefined ? ` (${itemReturn.left} left)` : '';
  return `\n> **Item Return:** ${itemReturn.quantity}x ${itemReturn.name}${leftText}`;
}

export default (transaction: Transaction, data?: TransactionData): string => {
  if (!data) {
    data = parseTransactionData(transaction);
  }

  let message = '';

  // Check for special metadata types (most specific first)
  if (data.kbc) {
    message = formatKBCForChat(data.kbc);
  } else if (data.itemReturn) {
    message = formatItemReturnForChat(data.itemReturn);
  } else if (data.refund) {
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
