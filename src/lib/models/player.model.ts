import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import { sequelize } from './database.js';

export interface RawPlayer {
  minecraftUUID: string;
  minecraftName: string;

  kromerAddress: string;

  notifications: string;
  transferNotificationsEnabled: boolean;
  lastSeenDate?: string | null;
  isKlogSetup?: boolean;

  createdDate?: string | null;
  updatedDate?: string | null;
}

export type PlayerWithStatus = RawPlayer & {
  online: boolean;
};

export class Player
  extends Model<InferAttributes<Player>, InferCreationAttributes<Player>>
  implements RawPlayer
{
  declare minecraftUUID: string;
  declare minecraftName: string;
  declare kromerAddress: string;
  declare notifications: CreationOptional<string>;
  declare transferNotificationsEnabled: CreationOptional<boolean>;
  declare lastSeenAt: CreationOptional<Date | null>;

  declare createdAt?: Date;
  declare updatedAt?: Date;

  raw(): RawPlayer {
    return {
      minecraftUUID: this.minecraftUUID,
      minecraftName: this.minecraftName,
      kromerAddress: this.kromerAddress,
      notifications: this.notifications,
      transferNotificationsEnabled: this.transferNotificationsEnabled,
      lastSeenDate: this.lastSeenAt ? this.lastSeenAt.toISOString() : null,
      createdDate: this.createdAt ? this.createdAt.toISOString() : null,
      updatedDate: this.updatedAt ? this.updatedAt.toISOString() : null,
    };
  }
}

Player.init(
  {
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
      defaultValue: 'none',
    },
    transferNotificationsEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    timestamps: true,
    tableName: 'players',
  },
);
