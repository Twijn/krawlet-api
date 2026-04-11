import { DataTypes, Model } from 'sequelize';
import { sequelize } from './database';

export type TransferStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type RawTransfer = {
  id: string;
  status: TransferStatus;
  error: string | null;
  workerId?: number;
  fromUUID: string;
  fromUsername: string;
  toUUID: string;
  toUsername: string;
  itemName?: string;
  quantity?: number;
  quantityTransferred: number;
  timestamp: string;
};

export class Transfer extends Model {
  public id!: string;
  public status!: TransferStatus;
  public error?: string | null;
  public workerId?: number | null;
  public fromUUID!: string;
  public fromUsername!: string;
  public toUUID!: string;
  public toUsername!: string;
  public itemName?: string;
  public quantity?: number;
  public quantityTransferred!: number;
  public timeout?: number;
  public timestamp!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  raw() {
    return {
      id: this.id,
      status: this.status,
      error: this.error,
      workerId: this.workerId ?? undefined,
      fromUUID: this.fromUUID,
      fromUsername: this.fromUsername,
      toUUID: this.toUUID,
      toUsername: this.toUsername,
      itemName: this.itemName ?? undefined,
      quantity: this.quantity ?? undefined,
      quantityTransferred: this.quantityTransferred,
      timestamp: this.createdAt.toISOString(),
    } as RawTransfer;
  }
}

Transfer.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending',
    },
    error: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    workerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    fromUUID: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    fromUsername: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    toUUID: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    toUsername: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    itemName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    quantityTransferred: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    timeout: {
      type: DataTypes.DECIMAL(3, 1), // Allows values like 0.5, 1.0, 30.0
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'transfers',
    modelName: 'Transfer',
  },
);
