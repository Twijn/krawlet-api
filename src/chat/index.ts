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
  const from = rcc.players?.find((p) => p.uuid === transfer.fromUUID);
  const to = rcc.players?.find((p) => p.uuid === transfer.toUUID);

  let quantityDisplay = transfer.quantityTransferred.toLocaleString();
  if (transfer.quantity && transfer.quantityTransferred !== transfer.quantity) {
    quantityDisplay += `/${transfer.quantity.toLocaleString()}`;
  }

  let fromMessage = `<gold>Your transfer to ${transfer.toUsername} has been completed</gold>`;
  let toMessage = `<gold>You have received a transfer from ${transfer.fromUsername}</gold>`;

  if (transfer.status === 'failed' || error) {
    fromMessage = `<red>Your transfer to ${transfer.toUsername} has failed</red>`;
    toMessage = `<red>A transfer from ${transfer.fromUsername} has failed</red>`;
  }

  if (transfer.itemName) {
    const nbtSuffix = transfer.itemNbt ? ` (NBT: ${transfer.itemNbt})` : '';
    fromMessage += `<yellow>: ${transfer.itemName}${nbtSuffix} x${quantityDisplay}</yellow>`;
    toMessage += `<yellow>: ${transfer.itemName}${nbtSuffix} x${quantityDisplay}</yellow>`;
  } else if (transfer.itemNbt) {
    fromMessage += `<yellow>: items (NBT: ${transfer.itemNbt}) x${quantityDisplay}</yellow>`;
    toMessage += `<yellow>: items (NBT: ${transfer.itemNbt}) x${quantityDisplay}</yellow>`;
  } else {
    fromMessage += `<yellow>: ${quantityDisplay} items</yellow>`;
    toMessage += `<yellow>: ${quantityDisplay} items</yellow>`;
  }

  if (from) {
    rcc.tell(from.uuid, fromMessage);
  }
  if (to) {
    rcc.tell(to.uuid, toMessage);
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
