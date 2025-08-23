import {Command} from "../../lib/types";
import {ChatboxCommand} from "reconnectedchat";
import {rcc} from "../index";
import {RawListing, searchListings} from "../../lib/models";

const formatListing = (listing: RawListing): string => {
    const prices = listing?.prices?.map(x => `${x.value} ${x.currency}`).join(", ") ?? "";
    let result = `${listing.itemDisplayName} <gray>|</gray> ${listing?.shop?.name} <gray>|</gray> ${prices}`;

    if (listing.shopBuysItem) {
        result += ` <red>[S]</red>`;
    }
    if (listing.dynamicPrice) {
        result += ` <blue>[D]</blue>`;
    }

    if (listing.shop?.locationCoordinates || listing.shop?.locationDescription) {
        const location = `${listing.shop?.locationCoordinates ?? ""} ${listing.shop?.locationDescription ?? ""}`;
        result += `\n    <gray>@ ${location}</gray>`;
    }

    return result;
}

const command: Command = {
    name: "findshop",
    aliases: ["fs"],
    description: "Find a shop that sells an item",
    usage: "findshop <item>",
    execute: async (cmd: ChatboxCommand) => {
        const query = cmd.args.join(" ");

        if (query.trim().length < 3) {
            rcc.tell(cmd.user, "<red>Item name requires at least three characters!</red>").catch(console.error);
            return;
        }

        const listings = (await searchListings(query))
            .map(x => x.raw());
        
        if (listings.length === 0) {
            rcc.tell(cmd.user, "<red>No listings found for that query!</red>").catch(console.error);
            return;
        }

        listings.sort((a, b) => {
            const priceA = a.prices?.[0]?.value ?? Infinity;
            const priceB = b.prices?.[0]?.value ?? Infinity;
            return Number(priceA) - Number(priceB);
        });

        const sellShops = listings.filter(x => x.shopBuysItem);
        const buyShops = listings.filter(x => !x.shopBuysItem);

        let result = `<gray>Listings for</gray> <white>${query}</white>`;

        if (sellShops.length > 0) {
            result += `\n<red>Sell Shops</red>`;
            sellShops.forEach((listing, i) => {
                result += `\n<gray>${i+1}.</gray> ${formatListing(listing)}`;
            });
        }

        if (buyShops.length > 0) {
            result += `\n<blue>Buy Shops</blue>`;
            buyShops.forEach((listing, i) => {
                result += `\n<gray>${i+1}.</gray> ${formatListing(listing)}`;
            });
        }

        rcc.tell(cmd.user, result).catch(console.error);
    }
};

export default command;
