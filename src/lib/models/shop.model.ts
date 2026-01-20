import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from './database.js';
import { ShopSyncData } from '../shopSyncValidate';
import { Listing, RawListing, updateListings } from './listing.model';

export interface RawShop {
  id: string;

  // shop info fields
  name: string;
  description: string | null;
  owner: string | null;
  computerId: number;

  softwareName: string | null;
  softwareVersion: string | null;

  locationCoordinates: string | null;
  locationDescription: string | null;
  locationDimension: string | null;

  hidden: boolean;

  items?: RawListing[];
  addresses?: string[];

  createdDate?: string | null;
  updatedDate?: string | null;
}

export function getShopId(data: ShopSyncData): string {
  return data.info.computerID.toString();
}

/**
 * Check if a shop should be visible in API responses.
 * Shops are hidden if:
 * 1. The hidden field is true, OR
 * 2. The shop hasn't been updated in over 1 month (30 days)
 */
export function isShopVisible(shop: Shop): boolean {
  if (shop.hidden) {
    return false;
  }

  // Check if shop is older than 1 month (30 days)
  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  if (shop.updatedAt && shop.updatedAt < oneMonthAgo) {
    return false;
  }

  return true;
}

export async function getShop(shopId: string): Promise<Shop | null> {
  const shop = await Shop.findOne({
    where: { id: shopId },
    include: [
      {
        association: 'items',
        include: ['prices'],
      },
    ],
  });

  if (shop && !isShopVisible(shop)) {
    return null;
  }

  return shop;
}

export async function getShops(): Promise<Shop[]> {
  const shops = await Shop.findAll({
    include: [
      {
        association: 'items',
        include: ['prices'],
      },
    ],
  });

  // Filter out hidden and old shops
  return shops.filter(isShopVisible);
}

export async function updateShop(data: ShopSyncData): Promise<void> {
  let locationCoordinates = null;

  if (
    Array.isArray(data.info.location?.coordinates) &&
    data.info.location.coordinates.length === 3
  ) {
    locationCoordinates = data.info.location.coordinates.join(' ');
  }

  await Shop.upsert({
    id: getShopId(data),
    name: data.info.name,
    computerId: data.info.computerID,
    description: data.info.description || null,
    owner: data.info.owner || null,
    softwareName: data.info.software?.name || null,
    softwareVersion: data.info.software?.version || null,
    locationCoordinates,
    locationDescription: data.info.location?.description || null,
    locationDimension: data.info.location?.dimension || null,
    hidden: false, // New shops are not hidden by default
  });

  await updateListings(data);
}

export class Shop
  extends Model<InferAttributes<Shop>, InferCreationAttributes<Shop>>
  implements RawShop
{
  declare id: string;

  declare name: string;
  declare description: string | null;
  declare owner: string | null;
  declare computerId: number;

  declare softwareName: string | null;
  declare softwareVersion: string | null;

  declare locationCoordinates: string | null;
  declare locationDescription: string | null;
  declare locationDimension: string | null;

  declare hidden: boolean;

  declare items?: Listing[];

  declare createdAt?: Date;
  declare updatedAt?: Date;

  public raw(): RawShop {
    const items = this.items?.map((item) => item.raw()) as RawListing[] | [];

    const addresses: string[] = [];

    for (const item of items) {
      for (const price of item.prices ?? []) {
        if (price.address && !addresses.includes(price.address)) {
          addresses.push(price.address);
        }
      }
    }

    return {
      id: this.id,
      name: this.name,
      description: this.description,
      owner: this.owner,
      computerId: this.computerId,
      softwareName: this.softwareName,
      softwareVersion: this.softwareVersion,
      locationCoordinates: this.locationCoordinates,
      locationDescription: this.locationDescription,
      locationDimension: this.locationDimension,
      hidden: this.hidden,
      items,
      addresses,
      createdDate: this.createdAt ? this.createdAt.toISOString() : null,
      updatedDate: this.updatedAt ? this.updatedAt.toISOString() : null,
    };
  }
}

Shop.init(
  {
    id: {
      type: DataTypes.CHAR(20),
      primaryKey: true,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    owner: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    computerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    softwareName: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    softwareVersion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    locationCoordinates: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    locationDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    locationDimension: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    hidden: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    timestamps: true,
    tableName: 'shops',
  },
);
