import {CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model} from 'sequelize';
import { sequelize } from './database.js';

export enum AdvertStatus {
    ACTIVE = "active",
    CANCELLED = "cancelled",
    EXPIRED = "expired",
}

export interface RawAdvert {
    id: number;
    playerUUID: string;
    content: string;
    status: AdvertStatus;

    createdDate?: string|null;
    updatedDate?: string|null;
}

export class Advert extends Model<InferAttributes<Advert>, InferCreationAttributes<Advert>> implements RawAdvert {
    declare id: CreationOptional<number>;
    declare playerUUID: string;
    declare content: string;
    declare status: AdvertStatus;

    declare createdAt?: Date;
    declare updatedAt?: Date;

    raw(): RawAdvert {
        return {
            id: this.id,
            playerUUID: this.playerUUID,
            content: this.content,
            status: this.status,
            createdDate: this.createdAt ? this.createdAt.toISOString() : null,
            updatedDate: this.updatedAt ? this.updatedAt.toISOString() : null,
        }
    }
}

Advert.init({
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
    playerUUID: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
    },
    content: {
        type: DataTypes.STRING(256),
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM,
        values: Object.values(AdvertStatus),
        defaultValue: AdvertStatus.ACTIVE,
        allowNull: false,
    },
}, {
    sequelize,
    timestamps: true,
    tableName: "adverts",
});
