import { Shop } from './shop.model';
import { Listing } from './listing.model';
import { Turtle } from './turtle.model';
import { TurtleStat } from './turtlestat.model';
import { ApiKey } from './apikey.model';
import { RequestLog } from './requestlog.model';
import { EstorageEntity } from './estorageentity.model';
import { EstorageEntityLink } from './estoragelink.model';

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

// RequestLog -> ApiKey association
RequestLog.belongsTo(ApiKey, {
  foreignKey: 'apiKeyId',
  as: 'apiKey',
});
ApiKey.hasMany(RequestLog, {
  foreignKey: 'apiKeyId',
  as: 'requestLogs',
});

// Ender storage entity associations
EstorageEntity.hasMany(EstorageEntityLink, {
  foreignKey: 'entityId',
  as: 'links',
});
EstorageEntityLink.belongsTo(EstorageEntity, {
  foreignKey: 'entityId',
  as: 'entity',
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
export * from './requestlog.model';
export * from './blockedip.model';
export * from './transfer.model';
export * from './estorageentity.model';
export * from './estoragelink.model';
