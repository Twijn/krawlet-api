import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ComponentType,
} from 'discord.js';
import { getStandardFooter } from './embedFooter';

export interface PaginationOptions {
  title: string;
  color?: number;
  pageSize?: number;
  externalUrl?: string;
  externalButtonLabel?: string;
  timeout?: number;
}

export interface PaginationPage {
  embed: EmbedBuilder;
  content?: string;
}

export class GenericPaginator {
  private pages: PaginationPage[];
  private currentPage: number = 0;
  private totalPages: number;
  private options: Required<Omit<PaginationOptions, 'externalUrl' | 'externalButtonLabel'>> &
    Pick<PaginationOptions, 'externalUrl' | 'externalButtonLabel'>;

  constructor(pages: PaginationPage[], options: PaginationOptions) {
    this.pages = pages;
    this.totalPages = pages.length;
    this.options = {
      title: options.title,
      color: options.color || 0x208eb8,
      pageSize: options.pageSize || 10,
      timeout: options.timeout || 300000, // 5 minutes
      externalUrl: options.externalUrl,
      externalButtonLabel: options.externalButtonLabel,
    };

    // Update each page embed with pagination info
    this.pages.forEach((page, index) => {
      page.embed
        .setTitle(`${this.options.title} (Page ${index + 1}/${this.totalPages})`)
        .setColor(this.options.color);

      const footer = page.embed.data.footer;
      const baseFooter = footer?.text || '';
      const standardFooter = getStandardFooter(baseFooter);

      page.embed.setFooter(standardFooter);
    });
  }

  private createButtons(page: number): ActionRowBuilder<ButtonBuilder> {
    const buttons = new ActionRowBuilder<ButtonBuilder>();

    // First page button
    const firstButton = new ButtonBuilder()
      .setCustomId('paginator_first')
      .setLabel('⏪ First')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0);

    // Previous button
    const previousButton = new ButtonBuilder()
      .setCustomId('paginator_previous')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0);

    // Next button
    const nextButton = new ButtonBuilder()
      .setCustomId('paginator_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page >= this.totalPages - 1);

    // Last page button
    const lastButton = new ButtonBuilder()
      .setCustomId('paginator_last')
      .setLabel('Last ⏩')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= this.totalPages - 1);

    buttons.addComponents(firstButton, previousButton, nextButton, lastButton);

    // External link button if provided
    if (this.options.externalUrl && this.options.externalButtonLabel) {
      const externalButton = new ButtonBuilder()
        .setLabel(this.options.externalButtonLabel)
        .setStyle(ButtonStyle.Link)
        .setURL(this.options.externalUrl);

      buttons.addComponents(externalButton);
    }

    return buttons;
  }

  private createDisabledButtons(): ActionRowBuilder<ButtonBuilder> {
    const buttons = new ActionRowBuilder<ButtonBuilder>();

    const previousButton = new ButtonBuilder()
      .setCustomId('paginator_previous')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    const nextButton = new ButtonBuilder()
      .setCustomId('paginator_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);

    buttons.addComponents(previousButton, nextButton);

    if (this.options.externalUrl && this.options.externalButtonLabel) {
      const externalButton = new ButtonBuilder()
        .setLabel(this.options.externalButtonLabel)
        .setStyle(ButtonStyle.Link)
        .setURL(this.options.externalUrl);

      buttons.addComponents(externalButton);
    }

    return buttons;
  }

  public async sendPaginatedMessage(interaction: ChatInputCommandInteraction): Promise<void> {
    if (this.pages.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(this.options.title)
        .setColor(this.options.color)
        .setDescription('No data found.')
        .setFooter(getStandardFooter());

      const buttons = new ActionRowBuilder<ButtonBuilder>();
      if (this.options.externalUrl && this.options.externalButtonLabel) {
        buttons.addComponents(
          new ButtonBuilder()
            .setLabel(this.options.externalButtonLabel)
            .setStyle(ButtonStyle.Link)
            .setURL(this.options.externalUrl),
        );
      }

      await interaction.editReply({
        embeds: [embed],
        components: buttons.components.length > 0 ? [buttons] : [],
      });
      return;
    }

    const currentPageData = this.pages[this.currentPage];
    const buttons = this.createButtons(this.currentPage);

    const response = await interaction.editReply({
      content: currentPageData.content,
      embeds: [currentPageData.embed],
      components: this.totalPages > 1 ? [buttons] : [],
    });

    if (this.totalPages <= 1) {
      return; // No need for pagination
    }

    // Set up button interaction collector
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: this.options.timeout,
    });

    collector.on('collect', async (buttonInteraction: ButtonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: 'You cannot interact with this pagination.',
          ephemeral: true,
        });
        return;
      }

      if (buttonInteraction.customId === 'paginator_first') {
        this.currentPage = 0;
      } else if (buttonInteraction.customId === 'paginator_previous') {
        this.currentPage = Math.max(0, this.currentPage - 1);
      } else if (buttonInteraction.customId === 'paginator_next') {
        this.currentPage = Math.min(this.totalPages - 1, this.currentPage + 1);
      } else if (buttonInteraction.customId === 'paginator_last') {
        this.currentPage = this.totalPages - 1;
      }

      const newPageData = this.pages[this.currentPage];
      const newButtons = this.createButtons(this.currentPage);

      await buttonInteraction.update({
        content: newPageData.content,
        embeds: [newPageData.embed],
        components: [newButtons],
      });
    });

    collector.on('end', async () => {
      // Disable buttons when the collector expires
      const disabledButtons = this.createDisabledButtons();

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
