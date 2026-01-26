import { Model, DataTypes } from 'sequelize';
import { sequelize } from './database';
import crypto from 'crypto';

export class ApiKey extends Model {
  public id!: string;
  public key!: string;
  public name!: string;
  public email!: string | null;
  public tier!: 'free' | 'premium';
  public rateLimit!: number;
  public isActive!: boolean;
  public lastUsedAt!: Date | null;
  public requestCount!: number;
  public mcUuid!: string | null;
  public mcName!: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static generateKey(): string {
    return `kraw_${crypto.randomBytes(32).toString('hex')}`;
  }

  static hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  async incrementUsage(): Promise<void> {
    this.lastUsedAt = new Date();
    this.requestCount += 1;
    await this.save();
  }
}

ApiKey.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(64),
      unique: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tier: {
      type: DataTypes.ENUM('free', 'premium'),
      defaultValue: 'free',
      allowNull: false,
    },
    rateLimit: {
      type: DataTypes.INTEGER,
      defaultValue: 1000,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    requestCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    mcUuid: {
      type: DataTypes.UUID,
      allowNull: true,
      unique: true,
      field: 'mc_uuid',
    },
    mcName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'mc_name',
    },
  },
  {
    sequelize,
    tableName: 'api_keys',
    modelName: 'ApiKey',
  },
);
