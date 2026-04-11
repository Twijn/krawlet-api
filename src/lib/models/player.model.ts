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
  lastSeenDate?: string | null;

  createdDate?: string | null;
  updatedDate?: string | null;
}

export type PlayerWithStatus = Player & {
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
  declare lastSeenAt: CreationOptional<Date | null>;

  declare estorageColorA?: number;
  declare estorageColorB?: number;
  declare estorageColorC?: number;

  declare createdAt?: Date;
  declare updatedAt?: Date;

  raw(): RawPlayer {
    return {
      minecraftUUID: this.minecraftUUID,
      minecraftName: this.minecraftName,
      kromerAddress: this.kromerAddress,
      notifications: this.notifications,
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
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    estorageColorA: {
      type: DataTypes.SMALLINT.UNSIGNED,
      validate: {
        isIn: [[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768]],
      },
      allowNull: true,
    },
    estorageColorB: {
      type: DataTypes.SMALLINT.UNSIGNED,
      validate: {
        isIn: [[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768]],
      },
      allowNull: true,
    },
    estorageColorC: {
      type: DataTypes.SMALLINT.UNSIGNED,
      validate: {
        isIn: [[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768]],
      },
      allowNull: true,
    },
  },
  {
    sequelize,
    timestamps: true,
    tableName: 'players',
  },
);
