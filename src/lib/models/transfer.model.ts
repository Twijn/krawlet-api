import { DataTypes, Model } from 'sequelize';
import { sequelize } from './database';
import type { RawTransferNotification } from './transfernotification.model';

export type TransferStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type RawTransfer = {
  id: string;
  status: TransferStatus;
  error: string | null;
  workerId?: number;
  fromEntityId: string;
  fromName: string;
  toEntityId: string;
  toName: string;
  itemName?: string;
  itemDisplayName?: string;
  itemNbt?: string;
  memo?: string;
  quantity?: number;
  timeout?: number;
  quantityTransferred: number;
  timestamp: string;
  notifications?: RawTransferNotification[];
};

export class Transfer extends Model {
  public id!: string;
  public status!: TransferStatus;
  public error?: string | null;
  public workerId?: number | null;
  public fromEntityId!: string;
  public fromName!: string;
  public toEntityId!: string;
  public toName!: string;
  public itemName?: string;
  public itemDisplayName?: string;
  public itemNbt?: string;
  public memo?: string;
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
      fromEntityId: this.fromEntityId,
      fromName: this.fromName,
      toEntityId: this.toEntityId,
      toName: this.toName,
      itemName: this.itemName ?? undefined,
      itemDisplayName: this.itemDisplayName ?? undefined,
      itemNbt: this.itemNbt ?? undefined,
      memo: this.memo ?? undefined,
      quantity: this.quantity ?? undefined,
      timeout:
        this.timeout !== undefined && this.timeout !== null ? Number(this.timeout) : undefined,
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
    fromEntityId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    fromName: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    toEntityId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    toName: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    itemName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    itemDisplayName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    itemNbt: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    memo: {
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
