import { ChatInputCommandInteraction } from 'discord.js';
import { InteractionHelper } from '../commands/helpers/DiscordCommand';
import { sendAddressMessage } from './addressMessage';
import playerManager from '../../lib/managers/playerManager';

/**
 * Shared function for displaying player information
 * Used by both /player and /balance player commands
 */
export async function handlePlayerLookup(
  interaction: ChatInputCommandInteraction,
  helper: InteractionHelper,
  playerName: string,
): Promise<void> {
  const player = playerManager.getPlayerFromName(playerName);

  if (!player) {
    await helper.error(`Player "${playerName}" not found or has no Kromer addresses.`);
    return;
  }

  await sendAddressMessage(`Player Information: ${playerName}`, player.kromerAddress, interaction);
}

/**
 * Shared function for displaying address information
 * Used by both /address and /balance address commands
 */
export async function handleAddressLookup(
  interaction: ChatInputCommandInteraction,
  _helper: InteractionHelper,
  addressString: string,
): Promise<void> {
  const normalizedAddress = addressString.toLowerCase();
  await sendAddressMessage(
    `Address Information: ${normalizedAddress}`,
    normalizedAddress,
    interaction,
  );
}
