import { Client } from 'reconnectedchat';

import commands from './commands';
import playerManager from '../lib/managers/playerManager';
import { RawTransfer } from '../lib/models';

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

  let fromMessage = `<blue>Your transfer to ${transfer.toName} has been completed</blue>`;
  let toMessage = `<blue>You have received a transfer from ${transfer.fromName}</blue>`;

  if (transfer.status === 'cancelled') {
    fromMessage = `<yellow>Your transfer to ${transfer.toName} was cancelled</yellow>`;
    toMessage = `<yellow>A transfer from ${transfer.fromName} was cancelled</yellow>`;
  } else if (transfer.status === 'failed' || error) {
    fromMessage = `<red>Your transfer to ${transfer.toName} has failed</red>`;
    toMessage = `<red>A transfer from ${transfer.fromName} has failed</red>`;
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
    fromMessage += `<br><gray><italic><bold>Memo:</bold> ${transfer.memo}</italic></gray>`;
    toMessage += `<br><gray><italic><bold>Memo:</bold> ${transfer.memo}</italic></gray>`;
  }

  if (error) {
    fromMessage += `<br><red>(${error})</red>`;
    toMessage += `<br><red>(${error})</red>`;
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
    console.log(`Executing command ${command.name} from player ${cmd.user.name}`);
    await command.execute(cmd);
  } catch (err) {
    console.error(`Error executing command ${command.name}`);
    console.error(err);
  }
});

rcc.on('join', async (join) => {
  await playerManager.getPlayerFromUser(join.user);
});

rcc.on('ready', () => {
  console.log('Connected to RCC chat!');
  chatConnectionStatus = 'connected';
  lastChatError = undefined;
});

rcc.on('ws_error', (err) => {
  console.error('RCC WebSocket error:', err);
  chatConnectionStatus = 'error';
  lastChatError = err?.message || 'WebSocket error';
});

rcc.on('closing', () => {
  console.log('RCC chat connection closing');
  chatConnectionStatus = 'disconnected';
});

chatConnectionStatus = 'connecting';
rcc.connect();
