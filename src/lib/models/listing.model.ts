import {CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Op} from 'sequelize';
import { sequelize } from './database.js';
import {ShopSyncData, ShopSyncListing} from "../shopSyncValidate";
import objectHash from "object-hash";
import {getShopId} from "./shop.model";

const LISTING_EXPIRY_TIME = 1000 * 60; // 1 minute

export async function getListings(): Promise<Listing[]> {
    return await Listing.findAll({
        include: [{
            association: 'prices',
        }],
    });
}

export async function getListing(listingId: string): Promise<Listing | null> {
    return await Listing.findByPk(listingId, {
        include: [{
            association: 'prices',
        }],
    });
}

export async function getListingsByShopId(shopId: string): Promise<Listing[]> {
    return await Listing.findAll({
        where: {
            shopId,
        },
        include: [{
            association: 'prices',
        }],
    });
}

export function hashListing(shopId: string, listing: ShopSyncListing): string {
    let partialListing: Partial<ShopSyncListing> & { shopId: string } = {
        ...listing, shopId,
    };
    delete partialListing.stock;
    return objectHash(partialListing);
}

export async function updatePrices(listingId: string, item: ShopSyncListing): Promise<void> {
    await ListingPrice.destroy({
        where: {
            listingId,
        }
    });
    for (const itemPrice of item.prices) {
        await ListingPrice.create({
            listingId,
            value: itemPrice.value,
            currency: itemPrice.currency,
            address: itemPrice.address || null,
            requiredMeta: itemPrice.requiredMeta || null,
        });
    }
}

export async function updateListings(data: ShopSyncData): Promise<void> {
    const shopId = getShopId(data);

    for (const item of data.items) {
        const hash = hashListing(shopId, item);

        const data = {
            shopId, hash,
            itemName: item.item.name,
            itemNbt: item.item.nbt,
            itemDisplayName: item.item.displayName,
            itemDescription: item.item.description,
            dynamicPrice: item.dynamicPrice,
            madeOnDemand: item.madeOnDemand,
            requiresInteraction: item.requiresInteraction,
            stock: item.stock ?? 0,
            updatedAt: new Date(),
        };

        const [listing, created] = await Listing.findOrCreate({
            where: { hash },
            defaults: data,
            paranoid: false,
        });

        if (!created) {
            await listing.update(data);

            if (listing.deletedAt) {
                await listing.restore();
            }
        }

        await updatePrices(listing.id, item);
    }

    await Listing.destroy({
        where: {
            shopId,
            updatedAt: {
                [Op.lt]: Date.now() - LISTING_EXPIRY_TIME
            }
        },
    });
}

export interface RawListing {
    id: string;
    shopId: string;

    itemName: string;
    itemNbt: string|null;
    itemDisplayName: string|null;
    itemDescription: string|null;

    dynamicPrice: boolean;
    madeOnDemand: boolean;
    requiresInteraction: boolean;
    stock: number;

    prices?: RawListingPrice[];

    createdDate?: string|null;
    updatedDate?: string|null;
}

export class Listing extends Model<InferAttributes<Listing>, InferCreationAttributes<Listing>> implements RawListing {
    declare id: CreationOptional<string>;
    declare shopId: string;

    /**
     * The hash field is only used internally to uniquely identify listings.
     * There is no need to return it to clients.
     */
    declare hash: string;

    declare itemName: string;
    declare itemNbt: string|null;
    declare itemDisplayName: string|null;
    declare itemDescription: string|null;

    declare dynamicPrice: CreationOptional<boolean>;
    declare madeOnDemand: CreationOptional<boolean>;
    declare requiresInteraction: CreationOptional<boolean>;
    declare stock: CreationOptional<number>;

    declare prices?: ListingPrice[];

    declare createdAt?: Date;
    declare updatedAt?: Date;
    declare deletedAt?: Date|null;

    public raw(): RawListing {
        return {
            id: this.id,
            shopId: this.shopId,
            itemName: this.itemName,
            itemNbt: this.itemNbt,
            itemDisplayName: this.itemDisplayName,
            itemDescription: this.itemDescription,
            dynamicPrice: this.dynamicPrice,
            madeOnDemand: this.madeOnDemand,
            requiresInteraction: this.requiresInteraction,
            stock: this.stock,
            prices: this.prices?.map(price => ({
                id: price.id,
                value: price.value,
                currency: price.currency,
                address: price.address,
                requiredMeta: price.requiredMeta,
            })) ?? [],
            createdDate: this.createdAt ? this.createdAt.toISOString() : null,
            updatedDate: this.updatedAt ? this.updatedAt.toISOString() : null,
        }
    }
}

Listing.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    shopId: {
        type: DataTypes.CHAR(20),
        allowNull: false,
        references: {
            model: "shops",
            key: "id",
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
}, {
    sequelize,
    timestamps: true,
    paranoid: true,
    tableName: "listings",
});

export interface RawListingPrice {
    id: string;
    value: number;
    currency: string;
    address: string | null;
    requiredMeta: string | null;
}

export class ListingPrice extends Model<InferAttributes<ListingPrice>, InferCreationAttributes<ListingPrice>> implements RawListingPrice {
    declare id: CreationOptional<string>;
    declare listingId: string;
    declare value: number;
    declare currency: string;
    declare address: string|null;
    declare requiredMeta: string|null;
}

ListingPrice.init({
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
        type: DataTypes.DECIMAL(15, 2), // Supports large numbers with 2 decimal places
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
}, {
    sequelize,
    timestamps: false,
    tableName: "listing_prices",
});

// Set up associations
Listing.hasMany(ListingPrice, { foreignKey: 'listingId', as: 'prices' });
ListingPrice.belongsTo(Listing, { foreignKey: 'listingId' });
