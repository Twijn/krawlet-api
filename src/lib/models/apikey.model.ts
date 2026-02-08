import { Model, DataTypes } from 'sequelize';
import { sequelize } from './database';
import crypto from 'crypto';

/** Quick code expiration time in minutes */
const QC_EXPIRATION_MINUTES = 15;

/** API Key tiers - includes both rate limit tiers and special access tiers */
export type ApiKeyTier = 'free' | 'premium' | 'shopsync' | 'enderstorage' | 'internal';

export class ApiKey extends Model {
  public id!: string;
  public key!: string;
  public name!: string;
  public email!: string | null;
  public tier!: ApiKeyTier;
  public rateLimit!: number;
  public isActive!: boolean;
  public lastUsedAt!: Date | null;
  public requestCount!: number;
  public mcUuid!: string | null;
  public mcName!: string | null;
  public qcCode!: string | null;
  public qcExpires!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static generateKey(): string {
    return `kraw_${crypto.randomBytes(32).toString('hex')}`;
  }

  static hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Generate a 6-digit quick code (e.g., "003721")
   */
  static generateQuickCode(): string {
    const code = crypto.randomInt(0, 1000000);
    return code.toString().padStart(6, '0');
  }

  /**
   * Check if the quick code is still valid
   */
  isQuickCodeValid(): boolean {
    if (!this.qcCode || !this.qcExpires) return false;
    return new Date() < this.qcExpires;
  }

  /**
   * Set a new quick code with expiration
   */
  async setQuickCode(): Promise<string> {
    const code = ApiKey.generateQuickCode();
    this.qcCode = code;
    this.qcExpires = new Date(Date.now() + QC_EXPIRATION_MINUTES * 60 * 1000);
    await this.save();
    return code;
  }

  /**
   * Clear the quick code after use or expiration
   */
  async clearQuickCode(): Promise<void> {
    this.qcCode = null;
    this.qcExpires = null;
    await this.save();
  }

  /**
   * Find an API key by quick code (if not expired)
   */
  static async findByQuickCode(code: string): Promise<ApiKey | null> {
    const apiKey = await ApiKey.findOne({
      where: { qcCode: code },
    });

    if (!apiKey || !apiKey.isQuickCodeValid()) {
      return null;
    }

    return apiKey;
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
      type: DataTypes.ENUM('free', 'premium', 'shopsync', 'enderstorage', 'internal'),
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
    qcCode: {
      type: DataTypes.STRING(6),
      allowNull: true,
      field: 'qc_code',
    },
    qcExpires: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'qc_expires',
    },
  },
  {
    sequelize,
    tableName: 'api_keys',
    modelName: 'ApiKey',
  },
);
