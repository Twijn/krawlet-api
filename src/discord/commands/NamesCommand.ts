import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { DiscordCommand, InteractionHelper } from './helpers/DiscordCommand';
import { GenericPaginator, PaginationPage } from '../utils/genericPaginator';
import createTextTable from '../textTable';

export default class NamesCommand implements DiscordCommand {
  data = new SlashCommandBuilder()
    .setName('names')
    .setDescription('Browse all registered Kromer names')
    .addIntegerOption((option) =>
      option
        .setName('page_size')
        .setDescription('Number of names per page (5-25, default: 15)')
        .setMinValue(5)
        .setMaxValue(25)
        .setRequired(false),
    );

  defer = true;

  execute = async (
    interaction: ChatInputCommandInteraction,
    helper: InteractionHelper,
  ): Promise<void> => {
    const pageSize = interaction.options.getInteger('page_size') || 15;

    try {
      // Fetch all names to get the total count
      const response = await helper.kromer.names.getAll({ limit: 1 });
      const totalNames = response.total;

      if (totalNames === 0) {
        await helper.warning('No registered names found.');
        return;
      }

      // Calculate total pages
      const totalPages = Math.ceil(totalNames / pageSize);

      // Create pages for the paginator
      const pages: PaginationPage[] = [];

      for (let page = 0; page < totalPages; page++) {
        const offset = page * pageSize;
        const namesResponse = await helper.kromer.names.getAll({
          limit: pageSize,
          offset,
        });

        // Create table data with name and owner
        const tableData = namesResponse.names.map((name) => [`${name.name}.kro`, name.owner]);

        const tableContent = createTextTable(['Name', 'Owner'], tableData, ['left', 'left']);

        const embed = new EmbedBuilder().addFields({
          name: `Names ${offset + 1}-${Math.min(offset + pageSize, totalNames)}`,
          value: tableContent,
          inline: false,
        });

        pages.push({
          embed,
        });
      }

      const paginator = new GenericPaginator(pages, {
        title: 'Registered Kromer Names',
        color: 0x00ff88,
        externalUrl: 'https://kromer.club/names',
        externalButtonLabel: 'View on Kromer.club',
      });

      await paginator.sendPaginatedMessage(interaction);
    } catch (error) {
      console.error('Failed to fetch names:', error);
      await helper.error('Failed to fetch registered names.');
    }
  };
}
