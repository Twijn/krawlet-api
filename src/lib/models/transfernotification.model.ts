import { DataTypes, Model } from 'sequelize';
import { sequelize } from './database';

export type TransferNotificationType = 'error' | 'info' | 'success';

export type RawTransferNotification = {
  id: string;
  transferId: string;
  senderEntityId?: string;
  type: TransferNotificationType;
  message: string;
  timestamp: string;
};

export class TransferNotification extends Model {
  public id!: string;
  public transferId!: string;
  public senderEntityId?: string | null;
  public type!: TransferNotificationType;
  public message!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  raw(): RawTransferNotification {
    return {
      id: this.id,
      transferId: this.transferId,
      senderEntityId: this.senderEntityId ?? undefined,
      type: this.type,
      message: this.message,
      timestamp: this.createdAt.toISOString(),
    };
  }
}

TransferNotification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    transferId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    senderEntityId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('error', 'info', 'success'),
      allowNull: false,
      defaultValue: 'info',
    },
    message: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'transfer_notifications',
    modelName: 'TransferNotification',
  },
);
