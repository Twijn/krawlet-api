import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Op,
  Transaction,
} from 'sequelize';
import { sequelize } from './database.js';
import { ShopSyncData, ShopSyncListing } from '../shopSyncValidate';
import objectHash from 'object-hash';
import { getShopId, Shop } from './shop.model';

export async function getListings(): Promise<Listing[]> {
  console.time('getListings');
  const listings = await Listing.findAll({
    include: [
      {
        association: 'prices',
      },
      {
        association: 'shop',
        required: true,
      },
    ],
  });

  // Filter out listings from hidden or old shops
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const filteredListings = listings.filter((listing) => {
    if (!listing.shop) return false;
    if (listing.shop.hidden) return false;
    if (listing.shop.updatedAt && listing.shop.updatedAt < oneMonthAgo) return false;
    return true;
  });

  console.timeEnd('getListings');
  return filteredListings;
}

export async function getListing(listingId: string): Promise<Listing | null> {
  console.time('getListing');
  const listing = await Listing.findByPk(listingId, {
    include: [
      {
        association: 'prices',
      },
      {
        association: 'shop',
        required: true,
      },
    ],
  });

  if (listing && listing.shop) {
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

    if (listing.shop.hidden || (listing.shop.updatedAt && listing.shop.updatedAt < oneMonthAgo)) {
      console.timeEnd('getListing');
      return null;
    }
  }

  console.timeEnd('getListing');
  return listing;
}

export async function getListingsByShopId(shopId: string): Promise<Listing[]> {
  console.time('getListingsByShopId');

  // First check if the shop is visible
  const shop = await Shop.findByPk(shopId);
  if (!shop) {
    console.timeEnd('getListingsByShopId');
    return [];
  }

  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  if (shop.hidden || (shop.updatedAt && shop.updatedAt < oneMonthAgo)) {
    console.timeEnd('getListingsByShopId');
    return [];
  }

  const listings = await Listing.findAll({
    where: {
      shopId,
    },
    include: [
      {
        association: 'prices',
      },
    ],
  });
  console.timeEnd('getListingsByShopId');
  return listings;
}

export function hashListing(shopId: string, listing: ShopSyncListing): string {
  let partialListing: Partial<ShopSyncListing> & { shopId: string } = {
    ...listing,
    shopId,
  };
  delete partialListing.stock;
  delete partialListing.prices;
  return objectHash(partialListing);
}

export async function searchListings(query: string): Promise<Listing[]> {
  console.time('searchListings');
  const like = {
    [Op.like]: `%${query}%`,
  };
  const listings = await Listing.findAll({
    where: {
      [Op.or]: {
        itemName: like,
        itemDisplayName: like,
      },
    },
    include: [
      {
        association: 'prices',
      },
      {
        association: 'shop',
        required: true,
      },
    ],
  });

  // Filter out listings from hidden or old shops
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const filteredListings = listings.filter((listing) => {
    if (!listing.shop) return false;
    if (listing.shop.hidden) return false;
    if (listing.shop.updatedAt && listing.shop.updatedAt < oneMonthAgo) return false;
    return true;
  });

  console.timeEnd('searchListings');
  return filteredListings;
}

const ILLEGAL_CHAR_REGEX = /[^\w!@#$%^&()_+-=\[\]{}|;':",.\/? \n]+/gi;

export const safe = (str: string): string => {
  return str.replace(ILLEGAL_CHAR_REGEX, '').trim();
};

export const formatListing = (listing: RawListing): string => {
  let displayName = safe(listing.itemDisplayName ?? listing.itemName);

  if (listing.itemName) {
    displayName = `<hover:show_item:"${listing.itemName}":${Math.max(listing.stock, 1)}${listing.itemNbt ? ':' + listing.itemNbt : ''}>${displayName}</hover>`;
  }

  const prices =
    listing?.prices
      ?.map((x) => `${Number(x.value).toFixed(3).replace(/\.?0$/, '')} ${safe(x.currency)}`)
      .join(', ') ?? '';
  let result = `${displayName} <gray>|</gray> ${safe(listing?.shop?.name ?? '')} <gray>|</gray> ${safe(prices)}`;

  if (listing.stock === 0) {
    result += ` <red><bold>[OOS]</bold></red>`;
  } else {
    result += ` <green>[x${listing.stock}]</green>`;
  }

  if (listing.shopBuysItem) {
    result += ` <red>[S]</red>`;
  }
  if (listing.dynamicPrice) {
    result += ` <blue>[D]</blue>`;
  }

  if (listing.shop?.locationCoordinates || listing.shop?.locationDescription) {
    const location = `${listing.shop?.locationCoordinates ?? ''} ${listing.shop?.locationDescription ?? ''}`;
    result += `\n    <gray>@ ${location}</gray> <gray>|</gray> ${listing.shop?.locationDimension ?? ''}`;
  }

  return result;
};

export async function updatePrices(
  listingId: string,
  item: ShopSyncListing,
  transaction?: Transaction,
): Promise<void> {
  await ListingPrice.destroy({
    where: {
      listingId,
    },
    transaction,
  });

  for (const itemPrice of item.prices) {
    await ListingPrice.create(
      {
        listingId,
        value: itemPrice.value,
        currency: itemPrice.currency,
        address: itemPrice.address || null,
        requiredMeta: itemPrice.requiredMeta || null,
      },
      { transaction },
    );
  }
}

export async function updateListings(data: ShopSyncData): Promise<void> {
  console.time('updateListings');
  const shopId = getShopId(data);
  console.log(`Starting update for shop ${shopId} with ${data.items.length} items`);

  const t = await sequelize.transaction();
  try {
    console.time('updateListings:transaction');
    // Update or create current listings
    for (const item of data.items) {
      const hash = hashListing(shopId, item);
      console.log(`Processing item ${item.item.name} with hash ${hash}`);

      const data = {
        shopId,
        hash,
        itemName: item.item.name,
        itemNbt: item.item.nbt,
        itemDisplayName: item.item.displayName,
        itemDescription: item.item.description,
        shopBuysItem: item.shopBuysItem,
        noLimit: item.noLimit,
        dynamicPrice: item.dynamicPrice,
        madeOnDemand: item.madeOnDemand,
        requiresInteraction: item.requiresInteraction,
        stock: item.stock ?? 0,
        updatedAt: new Date(),
      };

      await Listing.upsert(data, { returning: true, transaction: t });
      const listing = await Listing.findOne({
        where: { shopId, hash },
        attributes: ['id'],
        transaction: t,
      });
      if (!listing?.id) throw new Error('Failed to upsert/find listing id');
      await updatePrices(listing.id, item, t);
    }

    console.log('Committing transaction...');
    await t.commit();
    console.timeEnd('updateListings:transaction');

    // After committing all upserts/prices, delete obsolete listings separately
    console.time('updateListings:cleanup');
    const currentHashes = data.items.map((item) => hashListing(shopId, item));
    const deleted = await Listing.destroy({
      where: {
        shopId,
        hash: {
          [Op.notIn]: currentHashes,
        },
      },
    });
    console.log(`Cleaned up ${deleted} obsolete listings`);
    console.timeEnd('updateListings:cleanup');
  } catch (err) {
    console.log('Error occurred, rolling back transaction:', err);
    await t.rollback();
    throw err;
  } finally {
    console.timeEnd('updateListings');
  }
}

export interface RawListing {
  id: string;
  shopId: string;

  itemName: string;
  itemNbt: string | null;
  itemDisplayName: string | null;
  itemDescription: string | null;

  shopBuysItem?: boolean | null;
  noLimit?: boolean | null;

  dynamicPrice: boolean;
  madeOnDemand: boolean;
  requiresInteraction: boolean;
  stock: number;

  prices?: RawListingPrice[];
  shop?: Shop;
  addresses?: string[];

  createdDate?: string | null;
  updatedDate?: string | null;
}

export class Listing
  extends Model<InferAttributes<Listing>, InferCreationAttributes<Listing>>
  implements RawListing
{
  declare id: CreationOptional<string>;
  declare shopId: string;

  /**
   * The hash field is only used internally to uniquely identify listings.
   * There is no need to return it to clients.
   */
  declare hash: string;

  declare itemName: string;
  declare itemNbt: string | null;
  declare itemDisplayName: string | null;
  declare itemDescription: string | null;

  declare shopBuysItem: CreationOptional<boolean>;
  declare noLimit: CreationOptional<boolean>;

  declare dynamicPrice: CreationOptional<boolean>;
  declare madeOnDemand: CreationOptional<boolean>;
  declare requiresInteraction: CreationOptional<boolean>;
  declare stock: CreationOptional<number>;

  declare prices?: ListingPrice[];
  declare shop?: Shop;

  declare createdAt?: Date;
  declare updatedAt?: Date;

  public raw(): RawListing {
    const prices =
      this.prices?.map((price) => ({
        id: price.id,
        value: price.value,
        currency: price.currency,
        address: price.address,
        requiredMeta: price.requiredMeta,
      })) ?? [];

    const addresses: string[] =
      (this.prices
        ?.map((price) => price?.address)
        .filter(
          (value, index, self) => typeof value === 'string' && self.indexOf(value) === index,
        ) as string[]) ?? [];

    return {
      id: this.id,
      shopId: this.shopId,
      itemName: this.itemName,
      itemNbt: this.itemNbt,
      itemDisplayName: this.itemDisplayName,
      itemDescription: this.itemDescription,
      shopBuysItem: this.shopBuysItem,
      noLimit: this.noLimit,
      dynamicPrice: this.dynamicPrice,
      madeOnDemand: this.madeOnDemand,
      requiresInteraction: this.requiresInteraction,
      stock: this.stock,
      prices,
      addresses,
      shop: this.shop,
      createdDate: this.createdAt ? this.createdAt.toISOString() : null,
      updatedDate: this.updatedAt ? this.updatedAt.toISOString() : null,
    };
  }
}

Listing.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    shopId: {
      type: DataTypes.CHAR(20),
      allowNull: false,
      references: {
        model: 'shops',
        key: 'id',
      },
    },
    hash: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    itemName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    itemNbt: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    itemDisplayName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    itemDescription: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    shopBuysItem: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    noLimit: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
    },
    dynamicPrice: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    madeOnDemand: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    requiresInteraction: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    timestamps: true,
    tableName: 'listings',
  },
);

export interface RawListingPrice {
  id: string;
  value: number;
  currency: string;
  address: string | null;
  requiredMeta: string | null;
}

export class ListingPrice
  extends Model<InferAttributes<ListingPrice>, InferCreationAttributes<ListingPrice>>
  implements RawListingPrice
{
  declare id: CreationOptional<string>;
  declare listingId: string;
  declare value: number;
  declare currency: string;
  declare address: string | null;
  declare requiredMeta: string | null;
}

ListingPrice.init(
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    listingId: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      references: {
        model: Listing,
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    value: {
      type: DataTypes.DECIMAL(15, 3), // Supports large numbers with 3 decimal places
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    requiredMeta: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    timestamps: false,
    tableName: 'listing_prices',
  },
);

// Set up associations
Listing.hasMany(ListingPrice, { foreignKey: 'listingId', as: 'prices' });
ListingPrice.belongsTo(Listing, { foreignKey: 'listingId' });
