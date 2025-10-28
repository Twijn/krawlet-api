import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  AutocompleteInteraction,
  codeBlock,
  cleanCodeBlockContent,
} from 'discord.js';
import { DiscordCommand, InteractionHelper, AutocompleteHelper } from './helpers/DiscordCommand';
import { getShop, getShops, RawShop } from '../../lib/models/shop.model';
import { searchListings, RawListing } from '../../lib/models/listing.model';
import { addStandardFooter } from '../utils/embedFooter';
import { GenericPaginator, PaginationPage } from '../utils/genericPaginator';
import createTextTable from '../textTable';
import { formatKromerAmount } from '../../lib/formatKromer';

const code = (val: string | number): string => codeBlock(cleanCodeBlockContent(String(val)));

export default class FindShopCommand implements DiscordCommand {
  data = new SlashCommandBuilder()
    .setName('findshop')
    .setDescription('Find shops and items for sale')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('shop')
        .setDescription('Look up information about a specific shop')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('The shop name or ID to look up')
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('items')
        .setDescription('Search for items for sale across all shops')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('The item name to search for (min 3 characters)')
            .setRequired(true)
            .setMinLength(3),
        )
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Filter by shop type')
            .setRequired(false)
            .addChoices(
              { name: 'Buy Shops (players can buy)', value: 'buy' },
              { name: 'Sell Shops (players can sell)', value: 'sell' },
              { name: 'All Shops', value: 'all' },
            ),
        ),
    );

  defer = true;

  execute = async (
    interaction: ChatInputCommandInteraction,
    helper: InteractionHelper,
  ): Promise<void> => {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'shop':
        await this.handleShopLookup(interaction, helper);
        break;
      case 'items':
        await this.handleItemSearch(interaction, helper);
        break;
    }
  };

  private async handleShopLookup(
    interaction: ChatInputCommandInteraction,
    _helper: InteractionHelper,
  ): Promise<void> {
    const shopInput = interaction.options.getString('name', true);

    // Try to find shop by ID first, then by name
    let shop = await getShop(shopInput);

    if (!shop) {
      // Search by name
      const shops = await getShops();
      shop = shops.find((s) => s.name.toLowerCase() === shopInput.toLowerCase()) ?? null;
    }

    if (!shop) {
      await interaction.editReply({
        embeds: [
          addStandardFooter(
            new EmbedBuilder()
              .setTitle('❌ Shop Not Found')
              .setDescription(`No shop found with name or ID: \`${shopInput}\``)
              .setColor(0xff0000),
          ),
        ],
      });
      return;
    }

    const rawShop = shop.toJSON() as RawShop;

    const items = rawShop.items ?? [];

    items.sort((a, b) => {
      const priceA = a.prices?.[0]?.value ?? Infinity;
      const priceB = b.prices?.[0]?.value ?? Infinity;
      return Number(priceA) - Number(priceB);
    });

    if (items.length === 0) {
      // Show basic shop info without pagination if no items
      const embed = new EmbedBuilder().setTitle(`🏪 ${rawShop.name}`).setColor(0xff9900);

      embed.setDescription('This shop has no items listed.');

      const fields: { name: string; value: string; inline?: boolean }[] = [
        {
          name: 'Computer ID',
          value: code(rawShop.computerId),
          inline: true,
        },
      ];

      if (rawShop.owner) {
        fields.push({ name: 'Owner', value: code(rawShop.owner), inline: true });
      }

      if (rawShop.locationCoordinates || rawShop.locationDescription || rawShop.locationDimension) {
        let locationValue = '';
        if (rawShop.locationCoordinates) {
          locationValue += `📍 ${rawShop.locationCoordinates}`;
        }
        if (rawShop.locationDescription) {
          locationValue += ` - ${rawShop.locationDescription}`;
        }
        if (rawShop.locationDimension) {
          locationValue += `\n${rawShop.locationDimension}`;
        }
        fields.push({
          name: 'Location',
          value: code(locationValue.trim()),
          inline: false,
        });
      }

      embed.addFields(fields);

      const software =
        `Shop is using ${rawShop.softwareName ?? 'Unknown'} v${rawShop.softwareVersion ?? ''}`.trim();

      await interaction.editReply({
        embeds: [addStandardFooter(embed, software)],
      });
      return;
    }

    // Sort items by price
    items.sort((a, b) => {
      const priceA = a.prices?.[0]?.value ?? Infinity;
      const priceB = b.prices?.[0]?.value ?? Infinity;
      return Number(priceA) - Number(priceB);
    });

    // Create paginated view
    const ITEMS_PER_PAGE = 10;
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

    const pages: PaginationPage[] = [];
    for (let page = 0; page < totalPages; page++) {
      pages.push({
        embed: this.createShopItemsPage(rawShop, items, page, ITEMS_PER_PAGE),
      });
    }

    const paginator = new GenericPaginator(pages, {
      title: `🏪 ${rawShop.name}`,
      color: 0x00ff00,
    });

    await paginator.sendPaginatedMessage(interaction);
  }

  private createShopItemsPage(
    shop: RawShop,
    items: RawListing[],
    page: number,
    itemsPerPage: number,
  ): EmbedBuilder {
    const start = page * itemsPerPage;
    const end = Math.min(start + itemsPerPage, items.length);
    const pageItems = items.slice(start, end);

    const embed = new EmbedBuilder().setColor(0x00ff00);

    // Shop description
    if (shop.description) {
      embed.setDescription(shop.description);
    }

    // Add basic info as fields
    const fields: { name: string; value: string; inline?: boolean }[] = [
      {
        name: 'Computer ID',
        value: code(shop.computerId),
        inline: true,
      },
    ];

    if (shop.owner) {
      fields.push({ name: 'Owner', value: code(shop.owner), inline: true });
    }

    fields.push({ name: 'Total Items', value: code(items.length), inline: true });

    // Location info
    if (shop.locationCoordinates || shop.locationDescription || shop.locationDimension) {
      let locationValue = '';
      if (shop.locationCoordinates) {
        locationValue += `📍 ${shop.locationCoordinates}`;
      }
      if (shop.locationDescription) {
        locationValue += ` - ${shop.locationDescription}`;
      }
      if (shop.locationDimension) {
        locationValue += `\n${shop.locationDimension}`;
      }
      fields.push({
        name: 'Location',
        value: code(locationValue.trim()),
        inline: false,
      });
    }

    embed.addFields(fields);

    // Create table for items
    const rows: string[][] = [];

    for (let i = 0; i < pageItems.length; i++) {
      const item = pageItems[i];

      const itemName = item.itemDisplayName || item.itemName || 'Unknown';
      const price = item.prices?.[0]
        ? `${formatKromerAmount(Number(item.prices[0].value))} ${item.prices[0].currency}`
        : 'N/A';

      let stock = '';
      if (item.stock === 0) {
        stock = 'OOS';
      } else if (item.noLimit || item.madeOnDemand) {
        stock = '∞';
      } else {
        stock = item.stock.toString();
      }

      let flags = '';
      if (item.shopBuysItem) flags += '[S] ';
      if (item.dynamicPrice) flags += '[D] ';
      if (item.madeOnDemand) flags += '[M] ';

      rows.push([itemName.substring(0, 20), price, stock, flags.trim()]);
    }

    const table = createTextTable(['Item', 'Price', 'Stock', 'Flags'], rows, [
      'left',
      'right',
      'right',
      'left',
    ]);
    embed.addFields({
      name: `Items ${start + 1}-${end} of ${items.length}`,
      value: table,
    });

    // Add legend
    embed.addFields({
      name: 'Legend',
      value: '[S] = Shop buys | [D] = Dynamic price | [M] = Made on demand | OOS = Out of stock',
      inline: false,
    });

    // Software info in footer
    const software =
      `Shop is using ${shop.softwareName ?? 'Unknown'} v${shop.softwareVersion ?? ''}`.trim();

    // Set footer directly - GenericPaginator will add the standard footer
    embed.setFooter({ text: software });

    return embed;
  }

  private async handleItemSearch(
    interaction: ChatInputCommandInteraction,
    _helper: InteractionHelper,
  ): Promise<void> {
    const query = interaction.options.getString('query', true);
    const typeFilter = interaction.options.getString('type') ?? 'all';

    const listings = await searchListings(query);

    if (listings.length === 0) {
      await interaction.editReply({
        embeds: [
          addStandardFooter(
            new EmbedBuilder()
              .setTitle('🔍 No Items Found')
              .setDescription(`No listings found for: \`${query}\``)
              .setColor(0xff9900),
          ),
        ],
      });
      return;
    }

    const rawListings = listings.map((l) => l.toJSON() as RawListing);

    // Sort by price
    rawListings.sort((a, b) => {
      const priceA = a.prices?.[0]?.value ?? Infinity;
      const priceB = b.prices?.[0]?.value ?? Infinity;
      return Number(priceA) - Number(priceB);
    });

    // Filter by type
    let filteredListings = rawListings;
    if (typeFilter === 'buy') {
      filteredListings = rawListings.filter((l) => !l.shopBuysItem);
    } else if (typeFilter === 'sell') {
      filteredListings = rawListings.filter((l) => l.shopBuysItem);
    }

    if (filteredListings.length === 0) {
      const typeLabel = typeFilter === 'buy' ? 'buy shops' : 'sell shops';
      await interaction.editReply({
        embeds: [
          addStandardFooter(
            new EmbedBuilder()
              .setTitle('🔍 No Items Found')
              .setDescription(`No ${typeLabel} found for: \`${query}\``)
              .setColor(0xff9900),
          ),
        ],
      });
      return;
    }

    // Create paginated view
    const ITEMS_PER_PAGE = 10;
    const totalPages = Math.ceil(filteredListings.length / ITEMS_PER_PAGE);

    const pages: PaginationPage[] = [];
    for (let page = 0; page < totalPages; page++) {
      pages.push({
        embed: this.createItemListingPage(query, filteredListings, page, ITEMS_PER_PAGE),
      });
    }

    const paginator = new GenericPaginator(pages, {
      title: `Items: ${query}`,
      color: 0x00aaff,
    });

    await paginator.sendPaginatedMessage(interaction);
  }

  private createItemListingPage(
    query: string,
    listings: RawListing[],
    page: number,
    itemsPerPage: number,
  ): EmbedBuilder {
    const start = page * itemsPerPage;
    const end = Math.min(start + itemsPerPage, listings.length);
    const pageListings = listings.slice(start, end);

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Items: ${query}`)
      .setDescription(`Found ${listings.length} listing${listings.length !== 1 ? 's' : ''}`)
      .setColor(0x00aaff);

    // Create table for listings
    const rows: string[][] = [];

    for (let i = 0; i < pageListings.length; i++) {
      const listing = pageListings[i];

      const itemName = listing.itemDisplayName || listing.itemName || 'Unknown';
      const shopName = listing.shop?.name || 'Unknown Shop';
      const price = listing.prices?.[0]
        ? `${formatKromerAmount(Number(listing.prices[0].value))} ${listing.prices[0].currency}`
        : 'N/A';

      rows.push([itemName.substring(0, 20), shopName.substring(0, 15), price]);
    }

    const table = createTextTable(['Item', 'Shop', 'Price'], rows, ['left', 'left', 'right']);
    embed.addFields({
      name: 'Listings',
      value: table,
    });

    return embed;
  }

  autocomplete = async (
    interaction: AutocompleteInteraction,
    _helper: AutocompleteHelper,
  ): Promise<void> => {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'shop') {
      const focusedValue = interaction.options.getFocused().toLowerCase();
      const shops = await getShops();

      const filtered = shops
        .filter(
          (shop) =>
            shop.name.toLowerCase().includes(focusedValue) ||
            shop.id.toLowerCase().includes(focusedValue),
        )
        .slice(0, 25)
        .map((shop) => ({
          name: `${shop.name} (ID: ${shop.id})`,
          value: shop.id,
        }));

      await interaction.respond(filtered);
    }
  };
}
