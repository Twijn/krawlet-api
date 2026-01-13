import { Shop } from './shop.model';
import { Listing } from './listing.model';
import { Turtle } from './turtle.model';
import { TurtleStat } from './turtlestat.model';

// Initialize model relationships
Shop.hasMany(Listing, {
  foreignKey: 'shopId',
  as: 'items',
});
Listing.belongsTo(Shop, {
  foreignKey: 'shopId',
  as: 'shop',
});

// Turtle associations
Turtle.hasMany(TurtleStat, {
  foreignKey: 'turtleId',
  as: 'stats',
});
TurtleStat.belongsTo(Turtle, {
  foreignKey: 'turtleId',
  as: 'turtle',
});

export * from './database';
export * from './player.model';
export * from './listing.model';
export * from './shop.model';
export * from './knownaddress.model';
export * from './turtle.model';
export * from './turtlestat.model';
export * from './changelog.model';
export * from './apikey.model';
