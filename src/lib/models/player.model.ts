import {CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model} from 'sequelize';
import { sequelize } from './database.js';

export interface RawPlayer {
    minecraftUUID: string;
    minecraftName: string;

    kromerAddress: string;

    notifications: string;

    createdDate?: string|null;
    updatedDate?: string|null;
}

export type PlayerWithStatus = Player & {
    online: boolean;
}

export class Player extends Model<InferAttributes<Player>, InferCreationAttributes<Player>> implements RawPlayer {
    declare minecraftUUID: string;
    declare minecraftName: string;
    declare kromerAddress: string;
    declare notifications: CreationOptional<string>;

    declare createdAt?: Date;
    declare updatedAt?: Date;

    raw(): RawPlayer {
        return {
            minecraftUUID: this.minecraftUUID,
            minecraftName: this.minecraftName,
            kromerAddress: this.kromerAddress,
            notifications: this.notifications,
            createdDate: this.createdAt ? this.createdAt.toISOString() : null,
            updatedDate: this.updatedAt ? this.updatedAt.toISOString() : null,
        }
    }
}

Player.init({
    minecraftUUID: {
        type: DataTypes.CHAR(36),
        primaryKey: true,
    },
    minecraftName: {
        type: DataTypes.STRING(30),
        allowNull: false,
    },
    kromerAddress: {
        type: DataTypes.CHAR(10),
        allowNull: false,
    },
    notifications: {
        type: DataTypes.STRING(1000),
        allowNull: false,
        defaultValue: "none",
    },
}, {
    sequelize,
    timestamps: true,
    tableName: "players",
});
