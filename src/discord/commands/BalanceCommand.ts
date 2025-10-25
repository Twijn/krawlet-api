import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AutocompleteInteraction,
} from 'discord.js';
import { DiscordCommand, InteractionHelper, AutocompleteHelper } from './helpers/DiscordCommand';
import { handlePlayerLookup, handleAddressLookup } from '../utils/commandShared';
import playerManager from '../../lib/managers/playerManager';

export default class BalanceCommand implements DiscordCommand {
  data = new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check Kromer balance for players or addresses')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('player')
        .setDescription("Check a player's Kromer balance and other information")
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('The player name to look up')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('address')
        .setDescription("Check an address's Kromer balance and other information")
        .addStringOption((option) =>
          option
            .setName('address')
            .setDescription('The Kromer address to look up')
            .setMinLength(10)
            .setMaxLength(10)
            .setRequired(true)
            .setAutocomplete(true),
        ),
    );

  defer = true;

  execute = async (
    interaction: ChatInputCommandInteraction,
    helper: InteractionHelper,
  ): Promise<void> => {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'player':
        await this.handlePlayerBalance(interaction, helper);
        break;
      case 'address':
        await this.handleAddressBalance(interaction, helper);
        break;
    }
  };

  private async handlePlayerBalance(
    interaction: ChatInputCommandInteraction,
    helper: InteractionHelper,
  ): Promise<void> {
    const playerName = interaction.options.getString('name', true);
    await handlePlayerLookup(interaction, helper, playerName);
  }

  private async handleAddressBalance(
    interaction: ChatInputCommandInteraction,
    helper: InteractionHelper,
  ): Promise<void> {
    const addressString = interaction.options.getString('address', true);
    await handleAddressLookup(interaction, helper, addressString);
  }

  autocomplete = async (
    interaction: AutocompleteInteraction,
    helper: AutocompleteHelper,
  ): Promise<void> => {
    const focusedOption = interaction.options.getFocused(true);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'player' && focusedOption.name === 'name') {
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
    } else if (subcommand === 'address' && focusedOption.name === 'address') {
      // Autocomplete addresses - get rich addresses as suggestions
      try {
        const richAddresses = await helper.kromer.addresses.getRich({ limit: 25 });
        const filtered = richAddresses.addresses
          .filter((addr) => addr.address.toLowerCase().includes(focusedOption.value.toLowerCase()))
          .map((addr) => ({
            name: `${addr.address} (${addr.balance.toLocaleString()} KST)`,
            value: addr.address,
          }));

        await interaction.respond(filtered);
      } catch (error) {
        console.error('Error fetching addresses for autocomplete:', error);
        await interaction.respond([]);
      }
    }
  };
}
