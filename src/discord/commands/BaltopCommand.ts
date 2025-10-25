import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { DiscordCommand, InteractionHelper } from './helpers/DiscordCommand';
import { formatKromerBalance } from '../../lib/formatKromer';
import createTextTable from '../textTable';
import playerManager from '../../lib/managers/playerManager';
import { addStandardFooter } from '../utils/embedFooter';
import { getRichAddressesExcludingServerwelf } from '../../lib/richAddressesHelper';

export default class BaltopCommand implements DiscordCommand {
  data = new SlashCommandBuilder()
    .setName('baltop')
    .setDescription('View the richest Kromer addresses')
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Number of addresses to show (1-25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false),
    );

  defer = true;

  execute = async (
    interaction: ChatInputCommandInteraction,
    helper: InteractionHelper,
  ): Promise<void> => {
    const limit = interaction.options.getInteger('limit') || 10;

    const response = await getRichAddressesExcludingServerwelf({ limit });

    if (response.addresses.length === 0) {
      await helper.warning('No addresses found.');
      return;
    }

    const supply = await helper.kromer.getSupply();

    const embed = new EmbedBuilder()
      .setTitle(`Top ${response.addresses.length} Richest Kromer Addresses`)
      .setDescription('The address `serverwelf` has been excluded from `% of Supply`.')
      .setColor(0xffd700); // Gold color for richest

    // Create table data with rank, player/address, and balance
    const tableData = response.addresses.map((addr, index) => {
      const player = playerManager.getPlayerFromAddress(addr.address);
      const displayName = player ? player.minecraftName : addr.address;
      const rank = `#${index + 1}`;
      const percentOfSupply = ((addr.balance / supply) * 100).toFixed(3) + '%';

      return [rank, displayName, formatKromerBalance(addr.balance), percentOfSupply];
    });

    embed.addFields({
      name: 'Richest Addresses',
      value: createTextTable(['Rank', 'Player/Address', 'Balance', '% of Supply'], tableData, [
        'right',
        'left',
        'right',
        'right',
      ]),
      inline: false,
    });

    // Add footer with version info
    addStandardFooter(embed);

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('View Rich List on Kromer.club')
        .setStyle(ButtonStyle.Link)
        .setURL('https://kromer.club/addresses/rich'),
    );

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } else {
      await interaction.reply({ embeds: [embed], components: [buttons], ephemeral: true });
    }
  };
}
