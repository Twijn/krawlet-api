import {Shop} from "./shop.model";
import {Listing} from "./listing.model";

// Initialize model relationships
Shop.hasMany(Listing, {
    foreignKey: 'shopId',
    as: 'items'
});
Listing.belongsTo(Shop, {
    foreignKey: 'shopId',
    as: 'shop'
});

export * from "./database";
export * from "./player.model";
export * from "./listing.model";
export * from "./shop.model";
