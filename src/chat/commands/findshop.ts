import {Command} from "../../lib/types";
import {ChatboxCommand} from "reconnectedchat";
import {rcc} from "../index";
import {formatListing, searchListings} from "../../lib/models";

const subArguments = [
    "buy", "b", "sell", "s",
]

const command: Command = {
    name: "findshop",
    aliases: ["fs"],
    description: "Find a shop that sells an item",
    usage: "findshop <item>",
    execute: async (cmd: ChatboxCommand) => {
        let includeBuy = true;
        let includeSell = true;

        if (cmd.args.length > 0 && subArguments.includes(cmd.args[0].toLowerCase())) {
            const setting = cmd.args.shift();
            if (setting === "buy" || setting === "b") {
                includeSell = false;
            } else if (setting === "sell" || setting === "s") {
                includeBuy = false;
            } else {
                return;
            }
        }

        const query = cmd.args.join(" ");

        if (query.trim().length < 3) {
            rcc.tell(cmd.user, "<red>Item name requires at least three characters!</red>").catch(console.error);
            return;
        }

        const listings = (await searchListings(query))
            .map(x => x.raw());

        listings.sort((a, b) => {
            const priceA = a.prices?.[0]?.value ?? Infinity;
            const priceB = b.prices?.[0]?.value ?? Infinity;
            return Number(priceA) - Number(priceB);
        });

        const sellShops = listings.filter(x => x.shopBuysItem);
        const buyShops = listings.filter(x => !x.shopBuysItem);
        
        if (listings.length === 0) {
            rcc.tell(cmd.user, "<red>No listings found for that query!</red>").catch(console.error);
            return;
        }

        let result = `<gray>Listings for</gray> <white>${query}</white>`;

        // Sell shops
        if (includeSell) {
            if (includeBuy && sellShops.length > 0) {
                result += `\n<red>Sell Shops</red>`;
            }

            if (sellShops.length > 0) {
                sellShops.forEach((listing, i) => {
                    result += `\n<gray>${i+1}.</gray> ${formatListing(listing)}`;
                });
            } else if (!includeBuy) {
                result += "\n<red>No sell shops found with this query!</red>";
            }
        }

        // Buy shops
        if (includeBuy) {
            if (includeSell && buyShops.length > 0) {
                result += `\n<blue>Buy Shops</blue>`;
            }

            if (buyShops.length > 0) {
                buyShops.forEach((listing, i) => {
                    result += `\n<gray>${i+1}.</gray> ${formatListing(listing)}`;
                });
            } else if (!includeSell) {
                result += "\n<red>No buy shops found with this query!</red>"
            }
        }

        rcc.tell(cmd.user, result).catch(console.error);
    }
};

export default command;
