import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AutocompleteInteraction,
} from 'discord.js';
import { DiscordCommand, InteractionHelper, AutocompleteHelper } from './helpers/DiscordCommand';
import { handlePlayerLookup } from '../utils/commandShared';
import playerManager from '../../lib/managers/playerManager';

export default class PlayerCommand implements DiscordCommand {
  data = new SlashCommandBuilder()
    .setName('player')
    .setDescription('Get detailed information about a player.')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('The Minecraft username of the player')
        .setRequired(true)
        .setAutocomplete(true),
    );

  defer = true;

  execute = async (
    interaction: ChatInputCommandInteraction,
    helper: InteractionHelper,
  ): Promise<void> => {
    const playerName = interaction.options.getString('name', true);
    await handlePlayerLookup(interaction, helper, playerName);
  };

  autocomplete = async (
    interaction: AutocompleteInteraction,
    _helper: AutocompleteHelper,
  ): Promise<void> => {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'name') {
      // Autocomplete player names
      const players = playerManager.getAll();
      const filtered = players
        .filter((player) =>
          player.minecraftName.toLowerCase().includes(focusedOption.value.toLowerCase()),
        )
        .slice(0, 25) // Discord limits to 25 choices
        .map((player) => ({
          name: player.minecraftName,
          value: player.minecraftName,
        }));

      await interaction.respond(filtered);
    }
  };
}
