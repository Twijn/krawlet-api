import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DiscordCommand, InteractionHelper } from './helpers/DiscordCommand';
import { TransactionPaginator } from '../utils/transactionPaginator';

export default class TransactionsCommand implements DiscordCommand {
  data = new SlashCommandBuilder()
    .setName('transactions')
    .setDescription('View the latest Kromer transactions')
    .addIntegerOption((option) =>
      option
        .setName('page_size')
        .setDescription('Initial number of transactions to load (1-25, default: 50)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName('include_welfare')
        .setDescription('Include welfare/mining transactions (default: false)')
        .setRequired(false),
    );

  defer = true;

  execute = async (
    interaction: ChatInputCommandInteraction,
    helper: InteractionHelper,
  ): Promise<void> => {
    const pageSize = interaction.options.getInteger('page_size') || 10;
    const includeWelfare = interaction.options.getBoolean('include_welfare') ?? false; // Default to false

    try {
      const transactionsResponse = await helper.kromer.transactions.getLatest({
        limit: 50,
        excludeMined: !includeWelfare,
      });

      const paginator = new TransactionPaginator({
        title: `Latest Kromer Transactions${includeWelfare ? ' (including welfare)' : ''}`,
        transactions: transactionsResponse.transactions,
        totalCount: transactionsResponse.total,
        pageSize,
        color: 0x208eb8,
        externalUrl: 'https://kromer.club/transactions',
        externalButtonLabel: 'View All on Kromer.club',
        helper,
        excludeMined: !includeWelfare,
      });

      await paginator.sendPaginatedMessage(interaction);
    } catch (error) {
      console.error(error);
      await helper.error('Failed to fetch latest transactions.');
    }
  };
}
