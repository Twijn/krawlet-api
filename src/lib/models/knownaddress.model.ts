import {CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model} from 'sequelize';
import { sequelize } from './database.js';

export type KnownAddressType = 'official' | 'shop' | 'gamble' | 'service' | 'company';

export interface RawKnownAddress {
    id: string;
    type: KnownAddressType;
    address: string;
    imageSrc?: string|null;
    name: string;
    description: string;
    createdDate?: string|null;
    updatedDate?: string|null;
}

export class KnownAddress extends Model<InferAttributes<KnownAddress>, InferCreationAttributes<KnownAddress>> implements RawKnownAddress {
    declare id: CreationOptional<string>;

    declare type: KnownAddressType;

    declare address: string;
    declare imageSrc: CreationOptional<string|null>;
    declare name: string;
    declare description: string;

    declare createdAt?: Date;
    declare updatedAt?: Date;

    raw(): RawKnownAddress {
        return {
            id: this.id,
            type: this.type,
            address: this.address,
            imageSrc: this.imageSrc,
            name: this.name,
            description: this.description,
            createdDate: this.createdAt ? this.createdAt.toISOString() : null,
            updatedDate: this.updatedAt ? this.updatedAt.toISOString() : null,
        }
    }
}

let addresses: RawKnownAddress[] = [];

export const getKnownAddresses = (): RawKnownAddress[] => {
    return addresses;
}

export const updateShopAddress = async (address: string, name: string, description: string): Promise<RawKnownAddress> => {
    if (address.length === 0 || address.length !== 10 || address.includes(" ")) {
        throw new Error("Address must be 10 characters long with no spaces!");
    } else if (name.length === 0 || name.length > 30) {
        throw new Error("Name must be between 1 and 30 characters long!");
    } else if (!/^[a-zA-Z0-9 ]+$/.test(name)) {
        throw new Error("Name can only contain letters, numbers and spaces!");
    } else if (description.length === 0 || description.length > 256) {
        throw new Error("Description must be between 1 and 256 characters long!");
    } else if (!/^[a-zA-Z0-9 !@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(description)) {
        throw new Error("Description can only contain letters, numbers, spaces and basic special characters!");
    }
    
    const [knownAddress, created] = await KnownAddress.findOrCreate({
        where: {
            address,
        },
        defaults: {
            type: "shop",
            address,
            name,
            description,
        }
    });

    if (!created) {
        knownAddress.name = name;
        knownAddress.description = description;
        await knownAddress.save();
    }

    addresses = addresses.filter(x => x.id !== knownAddress.id);
    addresses.push(knownAddress.raw());

    return knownAddress.raw()
}

export const deleteShopAddress = async (address: string): Promise<void> => {
    await KnownAddress.destroy({
        where: { address },
    });
    addresses = addresses.filter(x => x.address !== address);
}

const refreshAddresses = async () => {
    const knownAddresses = await KnownAddress.findAll();
    addresses = knownAddresses.map(x => x.raw());
    console.log("Known addresses refreshed");
}

setTimeout(refreshAddresses, 2000);

KnownAddress.init({
    id: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    type: {
        type: DataTypes.ENUM('official', 'shop', 'gamble', 'service', 'company'),
        allowNull: false,
    },
    address: {
        type: DataTypes.CHAR(10),
        allowNull: false,
    },
    imageSrc: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    name: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
}, {
    sequelize,
    timestamps: true,
    tableName: "knownaddresses",
});
