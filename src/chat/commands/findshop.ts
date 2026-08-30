import { Command } from '#lib/types';
import { ChatboxCommand } from 'reconnectedchat';
import { rcc } from '../index';
import { formatListing, getShop, getShops, RawListing, searchListings } from '#lib/models';

const subArguments = ['buy', 'b', 'sell', 's'];

const PAGE_SIZE = 6;
const SHOP_PAGE_SIZE = 10;

const parseListing = (listings: RawListing[], page: number, limit: number = PAGE_SIZE): string => {
  let result = '';
  const totalPages = Math.ceil(listings.length / limit);
  if (page > totalPages) page = totalPages;
  const start = (page - 1) * limit;
  const end = Math.min(start + limit, listings.length);
  result += ` &7(Page ${page}/${totalPages})`;
  listings.slice(start, end).forEach((listing, i) => {
    result += `\n&7${start + i + 1}.&f ${formatListing(listing)}`;
  });
  return result;
};

type Subcommand = (cmd: ChatboxCommand) => void | Promise<void>;

const subcommands: Record<string, Subcommand> = {
  shop: async (cmd) => {
    if (cmd.args.length === 0) {
      rcc.tell(cmd.user, '<red>You must specify a shop ID!</red>').catch(console.error);
      return;
    }

    const shopId = cmd.args[0];
    let shop = await getShop(shopId);

    if (!shop) {
      const filteredShops = (await getShops()).filter((s) =>
        s.name.toLowerCase().includes(shopId.toLowerCase()),
      );

      if (filteredShops.length === 1) {
        shop = filteredShops[0];
      } else {
        rcc
          .tell(cmd.user, `<red>Shop with ID <gray>${shopId}</gray> not found!</red>`)
          .catch(console.error);
        return;
      }
    }

    let result = `&7--- &fShop Information &7---\n&9&l${shop.name}`;
    if (shop.description) {
      result += `\n &7Description: &f${shop.description}`;
    }
    if (shop.sourceType) {
      let styledSource = shop.sourceType === 'modem' ? '&fModem' : '&f&lRadio Tower';
      result += `\n &7Source: ${styledSource}`;
    }
    if (shop.owner) {
      result += `\n &7Owner: &f${shop.owner}`;
    }
    if (shop.locationCoordinates || shop.locationDescription) {
      result += `\n &7Location:`;
      if (shop.locationCoordinates) {
        result += `\n   &7Coordinates: &f${shop.locationCoordinates.replace(/ /g, ', ')}`;
      }
      if (shop.locationDescription) {
        result += `\n   &7Description: &f${shop.locationDescription}`;
      }
    }
    if (shop.softwareName) {
      const supportsKlog =
        shop.softwareName.toLowerCase().includes('+klog') ||
        shop.softwareVersion?.toLowerCase().includes('+klog');
      result += `\n &7Software: &f${shop.softwareName} ${(shop.softwareVersion ?? '').replace(/\+klog/i, '').trim()}${supportsKlog ? ' &a&l[Supports Klog Delivery]' : ''}`;
    }
    rcc.tell(cmd.user, result, undefined, 'format').catch(console.error);
  },
  list: async (cmd) => {
    const page = parseInt(cmd.args[0]) || 1;
    const shops = await getShops();
    const totalPages = Math.ceil(shops.length / SHOP_PAGE_SIZE);
    if (page < 1 || page > totalPages) {
      rcc
        .tell(cmd.user, `<red>Page must be between 1 and ${totalPages}!</red>`)
        .catch(console.error);
      return;
    }
    let result = `&7--- &fShop List &7--- &7(Page ${page}/${totalPages})`;
    shops.slice((page - 1) * SHOP_PAGE_SIZE, page * SHOP_PAGE_SIZE).forEach((shop) => {
      result += `\n&7#${shop.id.padStart(4, '   ')} &f ${shop.name} &7by &f${shop.owner ?? '[unknown]'}&7`;
      if (shop.locationCoordinates) {
        result += ` &7[${shop.locationCoordinates.replace(/ /g, ', ')}]`;
      }
      if (shop.locationDescription) {
        result += ` &8&o${shop.locationDescription}`;
      }
    });
    rcc.tell(cmd.user, result, undefined, 'format').catch(console.error);
  },
  stats: async (cmd) => {
    const shops = await getShops();
    const totalShops = shops.length;
    const buyShops = shops.filter((s) => s.items?.some((l) => !l.shopBuysItem) ?? false);
    const sellShops = shops.filter((s) => s.items?.some((l) => l.shopBuysItem) ?? false);
    const totalListings = shops.reduce((sum, s) => sum + (s.items?.length ?? 0), 0);
    const averageListingsPerShop =
      totalShops > 0 ? (totalListings / totalShops).toFixed(2) : '0.00';
    const modemShops = shops.filter((s) => s.sourceType === 'modem');
    const radioTowerShops = shops.filter((s) => s.sourceType === 'radio_tower');
    const shopsWithLocation = shops.filter(
      (s) => Boolean(s.locationCoordinates) || Boolean(s.locationDescription),
    );
    const klogEnabledShops = shops.filter((s) => {
      const softwareName = s.softwareName?.toLowerCase() ?? '';
      const softwareVersion = s.softwareVersion?.toLowerCase() ?? '';
      return softwareName.includes('+klog') || softwareVersion.includes('+klog');
    });

    let result = `&7--- &fShop Statistics &7---`;
    result += `\n&7Total Shops: &f${totalShops}`;
    result += `\n&7- Modem Shops: &f${modemShops.length}`;
    result += `\n&7- Radio Tower Shops: &f${radioTowerShops.length} &8&o${radioTowerShops.map((s) => s.name).join(', ')}`;
    result += '\n&7&m-------';
    result += `\n&7- Buy Shops: &f${buyShops.length}`;
    result += `\n&7- Sell Shops: &f${sellShops.length}`;
    result += '\n&7&m-------';
    result += `\n&7Total Listings: &f${totalListings}`;
    result += `\n&7Average Listings per Shop: &f${averageListingsPerShop}`;
    result += '\n&7&m-------';
    result += `\n&7Shops With Location Info: &f${shopsWithLocation.length}`;
    result += `\n&7Shops Supporting &9Klog Delivery&7: &f${klogEnabledShops.length} &8&o${klogEnabledShops.map((s) => s.name).join(', ')}`;

    rcc.tell(cmd.user, result, undefined, 'format').catch(console.error);
  },
} as const;

const command: Command = {
  name: 'findshop',
  aliases: ['fs'],
  description: 'Find a shop that sells an item',
  usage: 'findshop [buy/sell] <item> [page]',
  execute: async (cmd: ChatboxCommand) => {
    let includeBuy = true;
    let includeSell = true;

    let page = 1;
    let limit = PAGE_SIZE;

    if (cmd.args.length > 0 && subcommands[cmd.args[0].toLowerCase()]) {
      const subcommand = cmd.args.shift()?.toLowerCase() ?? '';
      try {
        await subcommands[subcommand](cmd);
      } catch (err) {
        console.error(err);
        rcc
          .tell(cmd.user, `<red>Failed to execute subcommand ${subcommand}!</red>`)
          .catch(console.error);
      }
      return;
    }

    if (cmd.args.length > 0 && subArguments.includes(cmd.args[0].toLowerCase())) {
      const setting = cmd.args.shift();
      if (setting === 'buy' || setting === 'b') {
        includeSell = false;
      } else if (setting === 'sell' || setting === 's') {
        includeBuy = false;
      } else {
        return;
      }
      limit = 12; // Show more results if filtering by buy/sell since there will be fewer results overall
    }
    if (cmd.args.length > 0 && /^\d+$/.test(cmd.args[cmd.args.length - 1])) {
      page = parseInt(cmd.args.pop() ?? '1');
      if (page < 1) page = 1;
    }

    const query = cmd.args.join(' ');

    if (query.trim().length < 3) {
      rcc
        .tell(cmd.user, '<red>Item name requires at least three characters!</red>')
        .catch(console.error);
      return;
    }

    const listings = (await searchListings(query)).map((x) => x.raw());

    listings.sort((a, b) => {
      const priceA = a.prices?.[0]?.value ?? Infinity;
      const priceB = b.prices?.[0]?.value ?? Infinity;
      return Number(priceA) - Number(priceB);
    });

    const sellShops = listings.filter((x) => x.shopBuysItem);
    const buyShops = listings.filter((x) => !x.shopBuysItem);

    if (listings.length === 0) {
      rcc.tell(cmd.user, '<red>No listings found for that query!</red>').catch(console.error);
      return;
    }

    let result = `&7Listings for &f${query}&7: (${listings.length} total)`;

    // Sell shops
    if (includeSell) {
      if (includeBuy && sellShops.length > 0) {
        result += `\n&cSell Shops`;
      }

      if (sellShops.length > 0) {
        result += parseListing(sellShops, page, limit);
      } else if (!includeBuy) {
        result += '\n&cNo sell shops found with this query!';
      }
    }

    // Buy shops
    if (includeBuy) {
      if (includeSell && buyShops.length > 0) {
        result += `\n&9Buy Shops`;
      }

      if (buyShops.length > 0) {
        result += parseListing(buyShops, page, limit);
      } else if (!includeSell) {
        result += '\n&cNo buy shops found with this query!';
      }
    }
    rcc.tell(cmd.user, result, undefined, 'format').catch(console.error);
  },
};

export default command;
