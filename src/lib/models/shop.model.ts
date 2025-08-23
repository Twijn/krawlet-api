import {DataTypes, InferAttributes, InferCreationAttributes, Model} from 'sequelize';
import { sequelize } from './database.js';
import {ShopSyncData} from "../shopSyncValidate";
import {updateListings} from "./listing.model";

export interface RawShop {
    id: string;

    // shop info fields
    name: string;
    description: string|null;
    owner: string|null;
    computerId: number;

    softwareName: string|null;
    softwareVersion: string|null;

    locationCoordinates: string|null;
    locationDescription: string|null;
    locationDimension: string|null;

    createdDate?: string|null;
    updatedDate?: string|null;
}

export function getShopId(data: ShopSyncData): string {
    return data.info.computerID.toString();
}

export async function getShop(shopId: string): Promise<Shop | null> {
    return await Shop.findOne({
        where: {id: shopId},
        include: [{
            association: 'items',
            include: ['prices']
        }]
    });
}

export async function getShops(): Promise<Shop[]> {
    return await Shop.findAll({
        include: [{
            association: 'items',
            include: ['prices']
        }],
    });
}

export async function updateShop(data: ShopSyncData): Promise<void> {
    await Shop.upsert({
        id: getShopId(data),
        name: data.info.name,
        computerId: data.info.computerID,
        description: data.info.description || null,
        owner: data.info.owner || null,
        softwareName: data.info.software?.name || null,
        softwareVersion: data.info.software?.version || null,
        locationCoordinates: data.info.location?.coordinates?.join(" ") || null,
        locationDescription: data.info.location?.description || null,
        locationDimension: data.info.location?.dimension || null,
    });

    await updateListings(data);
}

export class Shop extends Model<InferAttributes<Shop>, InferCreationAttributes<Shop>> implements RawShop {
    declare id: string;

    declare name: string;
    declare description: string|null;
    declare owner: string|null;
    declare computerId: number;

    declare softwareName: string|null;
    declare softwareVersion: string|null;

    declare locationCoordinates: string|null;
    declare locationDescription: string|null;
    declare locationDimension: string|null;

    declare createdAt?: Date;
    declare updatedAt?: Date;

    public raw(): RawShop {
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
            createdDate: this.createdAt ? this.createdAt.toISOString() : null,
            updatedDate: this.updatedAt ? this.updatedAt.toISOString() : null,
        }
    }
}

Shop.init({
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
    }
}, {
    sequelize,
    timestamps: true,
    tableName: "shops",
});
