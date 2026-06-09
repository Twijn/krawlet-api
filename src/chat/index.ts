import { Client } from 'reconnectedchat';

import commands from './commands';
import playerManager from '../lib/managers/playerManager';
import { RawTransfer } from '../lib/models';
import { createLogger } from '../lib/logger';

const log = createLogger('Chat');

const PREFIX = process.env.PREFIX ?? '';

export const rcc = new Client(process.env.CHAT_LICENSE!, {
  defaultName: '&9Krawlet',
  defaultFormattingMode: 'minimessage',
});

export type ChatConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface ChatStatus {
  status: ChatConnectionStatus;
  lastError?: string;
  owner?: string;
  playerCount?: number;
}

let chatConnectionStatus: ChatConnectionStatus = 'disconnected';
let lastChatError: string | undefined;

export function getChatStatus(): ChatStatus {
  // Check the running property to determine connection status
  let status: ChatConnectionStatus = chatConnectionStatus;
  if (rcc.running && chatConnectionStatus !== 'error') {
    status = 'connected';
  }

  return {
    status,
    lastError: lastChatError,
    owner: rcc.owner,
    playerCount: rcc.players?.length,
  };
}

export function completeTransfer(transfer: RawTransfer, error: string | null = null) {
  const fromPlayer = playerManager.getPlayerFromName(transfer.fromName);
  const toPlayer = playerManager.getPlayerFromName(transfer.toName);

  const from = fromPlayer
    ? rcc.players?.find((p) => p.uuid === fromPlayer.minecraftUUID)
    : undefined;
  const to = toPlayer ? rcc.players?.find((p) => p.uuid === toPlayer.minecraftUUID) : undefined;

  let quantityDisplay = transfer.quantityTransferred.toLocaleString();
  if (transfer.quantity && transfer.quantityTransferred !== transfer.quantity) {
    quantityDisplay += `/${transfer.quantity.toLocaleString()}`;
  }

  let fromMessage = `<blue>Your transfer to <white>${transfer.toName}</white> has been completed</blue>`;
  let toMessage = `<blue>You have received a transfer from <white>${transfer.fromName}</white></blue>`;

  if (transfer.status === 'cancelled') {
    fromMessage = `<yellow>Your transfer to <white>${transfer.toName}</white> was cancelled</yellow>`;
    toMessage = `<yellow>A transfer from <white>${transfer.fromName}</white> was cancelled</yellow>`;
  } else if (transfer.status === 'failed' || error) {
    fromMessage = `<red>Your transfer to <gray>${transfer.toName}</gray> has failed</red>`;
    toMessage = `<red>A transfer from <gray>${transfer.fromName}</gray> has failed</red>`;
  }

  let wrapItem = transfer.itemDisplayName ?? transfer.itemName;
  if (transfer.itemNbt) {
    wrapItem = `<hover:show_text:'<blue>${wrapItem} (NBT: ${transfer.itemNbt})</blue>'>${wrapItem}</hover>`;
  }

  if (transfer.itemName || transfer.itemDisplayName) {
    fromMessage += `<gray>: ${wrapItem} x${quantityDisplay}</gray>`;
    toMessage += `<gray>: ${wrapItem} x${quantityDisplay}</gray>`;
  } else if (transfer.itemNbt) {
    fromMessage += `<gray>: ${wrapItem} x${quantityDisplay}</gray>`;
    toMessage += `<gray>: ${wrapItem} x${quantityDisplay}</gray>`;
  } else {
    fromMessage += `<gray>: ${quantityDisplay} items</gray>`;
    toMessage += `<gray>: ${quantityDisplay} items</gray>`;
  }

  if (transfer.memo) {
    fromMessage += `<br><bold>Memo:</bold> <gray><italic>${transfer.memo}</italic></gray>`;
    toMessage += `<br><bold>Memo:</bold> <gray><italic>${transfer.memo}</italic></gray>`;
  }

  if (error) {
    fromMessage += `<br><red>Error: ${error}</red>`;
    toMessage += `<br><red>Error: ${error}</red>`;
  }

  if (from && fromPlayer?.transferNotificationsEnabled) {
    rcc.tell(from.uuid, fromMessage).catch(console.error);
  }
  if (to && toPlayer?.transferNotificationsEnabled) {
    rcc.tell(to.uuid, toMessage).catch(console.error);
  }
}

rcc.on('command', async (cmd) => {
  let commandName = cmd.command.toLowerCase();

  if (PREFIX.length > 0) {
    if (!commandName.startsWith(PREFIX)) return;
    commandName = commandName.replace(PREFIX, '');
  }

  const command = commands.find(
    (c) => c.name === commandName || (c.aliases && c.aliases.includes(commandName)),
  );

  if (!command) return;

  try {
    log.info(`Executing command ${command.name} from player ${cmd.user.name}`);
    await command.execute(cmd);
  } catch (err) {
    log.error(`Error executing command ${command.name}`);
    log.error(err);
  }
});

rcc.on('join', async (join) => {
  await playerManager.getPlayerFromUser(join.user);
});

rcc.on('leave', async (leave) => {
  await playerManager.updateSeenAt(leave.user.uuid);
});

rcc.on('ready', () => {
  log.info('Connected to RCC chat!');
  chatConnectionStatus = 'connected';
  lastChatError = undefined;
});

rcc.on('ws_error', (err) => {
  log.error('RCC WebSocket error:', err);
  chatConnectionStatus = 'error';
  lastChatError = err?.message || 'WebSocket error';
});

rcc.on('closing', () => {
  log.info('RCC chat connection closing');
  chatConnectionStatus = 'disconnected';
});

chatConnectionStatus = 'connecting';
rcc.connect();
