import { Command } from '../../lib/types';
import { ChatboxCommand } from 'reconnectedchat';
import { rcc } from '../index';
import { formatListing, RawListing, searchListings } from '../../lib/models';

const subArguments = ['buy', 'b', 'sell', 's'];

const PAGE_SIZE = 3;

const parseListing = (listings: RawListing[], page: number, limit: number = PAGE_SIZE): string => {
  let result = '';
  const totalPages = Math.ceil(listings.length / limit);
  if (page > totalPages) page = totalPages;
  const start = (page - 1) * limit;
  const end = Math.min(start + limit, listings.length);
  result += ` <gray>(Page ${page}/${totalPages})</gray>`;
  listings.slice(start, end).forEach((listing, i) => {
    result += `\n<gray>${start + i + 1}.</gray> ${formatListing(listing)}`;
  });
  return result;
};

const command: Command = {
  name: 'findshop',
  aliases: ['fs'],
  description: 'Find a shop that sells an item',
  usage: 'findshop <item>',
  execute: async (cmd: ChatboxCommand) => {
    let includeBuy = true;
    let includeSell = true;

    let page = 1;
    let limit = PAGE_SIZE;

    if (cmd.args.length > 0 && subArguments.includes(cmd.args[0].toLowerCase())) {
      const setting = cmd.args.shift();
      if (setting === 'buy' || setting === 'b') {
        includeSell = false;
      } else if (setting === 'sell' || setting === 's') {
        includeBuy = false;
      } else {
        return;
      }
      limit = 2;
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

    let result = `<gray>Listings for</gray> <white>${query}</white>`;

    // Sell shops
    if (includeSell) {
      if (includeBuy && sellShops.length > 0) {
        result += `\n<red>Sell Shops</red>`;
      }

      if (sellShops.length > 0) {
        result += parseListing(sellShops, page, limit);
      } else if (!includeBuy) {
        result += '\n<red>No sell shops found with this query!</red>';
      }
    }

    // Buy shops
    if (includeBuy) {
      if (includeSell && buyShops.length > 0) {
        result += `\n<blue>Buy Shops</blue>`;
      }

      if (buyShops.length > 0) {
        result += parseListing(buyShops, page, limit);
      } else if (!includeSell) {
        result += '\n<red>No buy shops found with this query!</red>';
      }
    }

    rcc.tell(cmd.user, result).catch(console.error);
  },
};

export default command;
