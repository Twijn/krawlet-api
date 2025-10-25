import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ComponentType,
} from 'discord.js';
import { formatKromerBalance } from '../../lib/formatKromer';
import createTextTable from '../textTable';
import { parseTransactionData } from '../../lib/formatTransaction';
import { Transaction } from 'kromer';
import { getStandardFooter } from './embedFooter';
import { InteractionHelper } from '../commands/helpers/DiscordCommand';

export interface PaginatedTransactionsOptions {
  title: string;
  transactions: Transaction[];
  totalCount?: number; // Total number of transactions available (for pagination display)
  pageSize?: number;
  color?: number;
  externalUrl?: string;
  externalButtonLabel?: string;
  helper: InteractionHelper; // Needed to fetch more transactions
  excludeMined?: boolean; // Whether to exclude welfare/mining transactions
}

export interface PaginationButtons {
  previous: ButtonBuilder;
  next: ButtonBuilder;
  external?: ButtonBuilder;
}

export class TransactionPaginator {
  private transactions: Transaction[];
  private pageSize: number;
  private totalPages: number;
  private totalCount: number;
  private currentPage: number = 0;
  private title: string;
  private color: number;
  private externalUrl?: string;
  private externalButtonLabel?: string;
  private helper: InteractionHelper;
  private excludeMined: boolean;

  constructor(options: PaginatedTransactionsOptions) {
    this.transactions = options.transactions;
    this.pageSize = options.pageSize || 10;
    this.totalCount = options.totalCount || this.transactions.length;
    this.totalPages = Math.ceil(this.totalCount / this.pageSize);
    this.title = options.title;
    this.color = options.color || 0x208eb8;
    this.externalUrl = options.externalUrl;
    this.externalButtonLabel = options.externalButtonLabel;
    this.helper = options.helper;
    this.excludeMined = options.excludeMined ?? true; // Default to excluding welfare
  }

  private async ensureTransactionsLoaded(page: number): Promise<void> {
    const startIndex = page * this.pageSize;
    const endIndex = startIndex + this.pageSize;

    // Check if we need to fetch more transactions
    if (endIndex > this.transactions.length && this.transactions.length < this.totalCount) {
      try {
        // Calculate how many more transactions we need
        const needed = Math.min(endIndex, this.totalCount) - this.transactions.length;
        const response = await this.helper.kromer.transactions.getLatest({
          limit: Math.max(needed, this.pageSize * 2), // Fetch at least 2 pages worth
          offset: this.transactions.length,
          excludeMined: this.excludeMined,
        });

        // Append new transactions
        this.transactions.push(...response.transactions);
      } catch (error) {
        console.error('Failed to fetch more transactions:', error);
      }
    }
  }

  private async createEmbed(page: number): Promise<EmbedBuilder> {
    await this.ensureTransactionsLoaded(page);
    const startIndex = page * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, this.transactions.length);
    const pageTransactions = this.transactions.slice(startIndex, endIndex);

    const embed = new EmbedBuilder()
      .setTitle(`${this.title} (Page ${page + 1}/${this.totalPages})`)
      .setColor(this.color);

    if (pageTransactions.length > 0) {
      embed.addFields({
        name: 'Transactions',
        value: createTextTable(
          ['ID', 'From', 'To', 'Amount'],
          pageTransactions.map((tx) => {
            const data = parseTransactionData(tx);
            return [`#${tx.id}`, data.from, data.to, formatKromerBalance(tx.value)];
          }),
          ['right', 'left', 'left', 'right'],
        ),
        inline: false,
      });
    } else {
      embed.addFields({
        name: 'Transactions',
        value: 'No transactions found.',
        inline: false,
      });
    }

    const footerConfig = getStandardFooter(
      `Showing ${startIndex + 1}-${endIndex} of ${this.totalCount} transactions`,
    );
    embed.setFooter(footerConfig);

    return embed;
  }

  private createButtons(page: number): ActionRowBuilder<ButtonBuilder> {
    const buttons = new ActionRowBuilder<ButtonBuilder>();

    // First page button
    const firstButton = new ButtonBuilder()
      .setCustomId('transactions_first')
      .setLabel('⏪ First')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0);

    // Previous button
    const previousButton = new ButtonBuilder()
      .setCustomId('transactions_previous')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0);

    // Next button
    const nextButton = new ButtonBuilder()
      .setCustomId('transactions_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= this.totalPages - 1);

    // Last page button
    const lastButton = new ButtonBuilder()
      .setCustomId('transactions_last')
      .setLabel('Last ⏩')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= this.totalPages - 1);

    buttons.addComponents(firstButton, previousButton, nextButton, lastButton);

    // External link button if provided
    if (this.externalUrl && this.externalButtonLabel) {
      const externalButton = new ButtonBuilder()
        .setLabel(this.externalButtonLabel)
        .setStyle(ButtonStyle.Link)
        .setURL(this.externalUrl);

      buttons.addComponents(externalButton);
    }

    return buttons;
  }

  public async sendPaginatedMessage(interaction: ChatInputCommandInteraction): Promise<void> {
    if (this.transactions.length === 0) {
      const embed = new EmbedBuilder().setTitle(this.title).setColor(this.color).addFields({
        name: 'Transactions',
        value: 'No transactions found.',
        inline: false,
      });

      const buttons = new ActionRowBuilder<ButtonBuilder>();
      if (this.externalUrl && this.externalButtonLabel) {
        buttons.addComponents(
          new ButtonBuilder()
            .setLabel(this.externalButtonLabel)
            .setStyle(ButtonStyle.Link)
            .setURL(this.externalUrl),
        );
      }

      await interaction.editReply({
        embeds: [embed],
        components: buttons.components.length > 0 ? [buttons] : [],
      });
      return;
    }

    const embed = await this.createEmbed(this.currentPage);
    const buttons = this.createButtons(this.currentPage);

    const response = await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });

    // Set up button interaction collector
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 300000, // 5 minutes
    });

    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: 'You cannot interact with this pagination.',
          ephemeral: true,
        });
        return;
      }

      if (buttonInteraction.customId === 'transactions_first') {
        this.currentPage = 0;
      } else if (buttonInteraction.customId === 'transactions_previous') {
        this.currentPage = Math.max(0, this.currentPage - 1);
      } else if (buttonInteraction.customId === 'transactions_next') {
        this.currentPage = Math.min(this.totalPages - 1, this.currentPage + 1);
      } else if (buttonInteraction.customId === 'transactions_last') {
        this.currentPage = this.totalPages - 1;
      }

      const newEmbed = await this.createEmbed(this.currentPage);
      const newButtons = this.createButtons(this.currentPage);

      await buttonInteraction.update({
        embeds: [newEmbed],
        components: [newButtons],
      });
    });

    collector.on('end', async () => {
      // Disable buttons when the collector expires
      const disabledButtons = new ActionRowBuilder<ButtonBuilder>();

      const previousButton = new ButtonBuilder()
        .setCustomId('transactions_previous')
        .setLabel('◀ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const nextButton = new ButtonBuilder()
        .setCustomId('transactions_next')
        .setLabel('Next ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      disabledButtons.addComponents(previousButton, nextButton);

      if (this.externalUrl && this.externalButtonLabel) {
        const externalButton = new ButtonBuilder()
          .setLabel(this.externalButtonLabel)
          .setStyle(ButtonStyle.Link)
          .setURL(this.externalUrl);

        disabledButtons.addComponents(externalButton);
      }

      try {
        await response.edit({
          components: [disabledButtons],
        });
      } catch (error) {
        // Message might have been deleted, ignore the error
        console.log('Could not disable pagination buttons:', error);
      }
    });
  }
}
