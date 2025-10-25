import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AutocompleteInteraction,
} from 'discord.js';
import { DiscordCommand, AutocompleteHelper, InteractionHelper } from './helpers/DiscordCommand';
import { handleAddressLookup } from '../utils/commandShared';

export default class AddressCommand implements DiscordCommand {
  data = new SlashCommandBuilder()
    .setName('address')
    .setDescription('Get information about a specific Kromer address.')
    .addStringOption((o) =>
      o
        .setName('address')
        .setMinLength(10)
        .setMaxLength(10)
        .setDescription('The address to look up')
        .setRequired(true)
        .setAutocomplete(true),
    );

  defer = true;

  execute = async (
    interaction: ChatInputCommandInteraction,
    helper: InteractionHelper,
  ): Promise<void> => {
    const addressString = interaction.options.getString('address', true);

    await handleAddressLookup(interaction, helper, addressString);
  };

  autocomplete = async (
    interaction: AutocompleteInteraction,
    helper: AutocompleteHelper,
  ): Promise<void> => {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'address') {
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
