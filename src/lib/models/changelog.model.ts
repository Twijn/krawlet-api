/**
 * Change Log Models - Persistent storage for shop, item, and price changes
 */

import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Op,
  CreationOptional,
} from 'sequelize';
import { sequelize } from './database';

// ============================================================================
// Shop Change Log Model
// ============================================================================

export class ShopChangeLog extends Model<
  InferAttributes<ShopChangeLog>,
  InferCreationAttributes<ShopChangeLog>
> {
  declare id: CreationOptional<number>;
  declare shopId: string;
  declare shopName: string;
  declare field: string;
  declare previousValue: string | null;
  declare newValue: string | null;
  declare isNewShop: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ShopChangeLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shopId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    shopName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    field: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    previousValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    newValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isNewShop: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'shop_change_logs',
  },
);

// ============================================================================
// Item Change Log Model
// ============================================================================

export type ItemChangeType = 'added' | 'removed';

export class ItemChangeLog extends Model<
  InferAttributes<ItemChangeLog>,
  InferCreationAttributes<ItemChangeLog>
> {
  declare id: CreationOptional<number>;
  declare shopId: string;
  declare shopName: string;
  declare changeType: ItemChangeType;
  declare itemName: string;
  declare itemDisplayName: string;
  declare itemHash: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

ItemChangeLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shopId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    shopName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    changeType: {
      type: DataTypes.ENUM('added', 'removed'),
      allowNull: false,
    },
    itemName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    itemDisplayName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    itemHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'item_change_logs',
  },
);

// ============================================================================
// Price Change Log Model
// ============================================================================

export class PriceChangeLog extends Model<
  InferAttributes<PriceChangeLog>,
  InferCreationAttributes<PriceChangeLog>
> {
  declare id: CreationOptional<number>;
  declare shopId: string;
  declare shopName: string;
  declare itemName: string;
  declare itemDisplayName: string;
  declare itemHash: string;
  declare field: string;
  declare previousValue: string | null;
  declare newValue: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

PriceChangeLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    shopId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    shopName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    itemName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    itemDisplayName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    itemHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    field: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    previousValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    newValue: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'price_change_logs',
  },
);

// ============================================================================
// Query Helper Functions
// ============================================================================

export interface ChangeLogQueryOptions {
  shopId?: string;
  limit?: number;
  offset?: number;
  since?: Date;
  until?: Date;
}

export async function getShopChangeLogs(options: ChangeLogQueryOptions = {}) {
  const where: any = {};

  if (options.shopId) {
    where.shopId = options.shopId;
  }
  if (options.since || options.until) {
    where.createdAt = {};
    if (options.since) where.createdAt[Op.gte] = options.since;
    if (options.until) where.createdAt[Op.lte] = options.until;
  }

  return ShopChangeLog.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: options.limit,
    offset: options.offset,
  });
}

export async function getItemChangeLogs(
  options: ChangeLogQueryOptions & { changeType?: ItemChangeType } = {},
) {
  const where: any = {};

  if (options.shopId) {
    where.shopId = options.shopId;
  }
  if (options.changeType) {
    where.changeType = options.changeType;
  }
  if (options.since || options.until) {
    where.createdAt = {};
    if (options.since) where.createdAt[Op.gte] = options.since;
    if (options.until) where.createdAt[Op.lte] = options.until;
  }

  return ItemChangeLog.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: options.limit,
    offset: options.offset,
  });
}

export async function getPriceChangeLogs(
  options: ChangeLogQueryOptions & { itemHash?: string } = {},
) {
  const where: any = {};

  if (options.shopId) {
    where.shopId = options.shopId;
  }
  if (options.itemHash) {
    where.itemHash = options.itemHash;
  }
  if (options.since || options.until) {
    where.createdAt = {};
    if (options.since) where.createdAt[Op.gte] = options.since;
    if (options.until) where.createdAt[Op.lte] = options.until;
  }

  return PriceChangeLog.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: options.limit,
    offset: options.offset,
  });
}

export async function getChangeLogStats() {
  const [shopChanges, itemChanges, priceChanges] = await Promise.all([
    ShopChangeLog.count(),
    ItemChangeLog.count(),
    PriceChangeLog.count(),
  ]);

  return {
    shopChanges,
    itemChanges,
    priceChanges,
    total: shopChanges + itemChanges + priceChanges,
  };
}
