import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from './database';

export type RequestLogTier =
  | 'anonymous'
  | 'free'
  | 'premium'
  | 'shopsync'
  | 'enderstorage'
  | 'worker'
  | 'internal';

interface RequestLogAttributes {
  id: string;
  timestamp: Date;
  ipAddress: string;
  apiKeyId?: string;
  tier: RequestLogTier;
  wasBlocked: boolean;
  blockReason?: string;
}

interface RequestLogCreationAttributes
  extends Optional<RequestLogAttributes, 'id' | 'timestamp' | 'apiKeyId' | 'blockReason'> {}

export class RequestLog
  extends Model<RequestLogAttributes, RequestLogCreationAttributes>
  implements RequestLogAttributes
{
  declare id: string;
  declare timestamp: Date;
  declare ipAddress: string;
  declare apiKeyId?: string;
  declare tier: RequestLogTier;
  declare wasBlocked: boolean;
  declare blockReason?: string;

  /**
   * Helper method to log a request
   */
  static async logRequest(
    data: Omit<RequestLogCreationAttributes, 'id' | 'timestamp'>,
  ): Promise<RequestLog> {
    return await RequestLog.create(data);
  }

  /**
   * Query logs by API key
   */
  static async getByApiKey(apiKeyId: string, limit = 100): Promise<RequestLog[]> {
    return await RequestLog.findAll({
      where: { apiKeyId },
      order: [['timestamp', 'DESC']],
      limit,
    });
  }

  /**
   * Query logs by IP address
   */
  static async getByIp(ipAddress: string, limit = 100): Promise<RequestLog[]> {
    return await RequestLog.findAll({
      where: { ipAddress },
      order: [['timestamp', 'DESC']],
      limit,
    });
  }

  /**
   * Get blocked requests
   */
  static async getBlocked(limit = 100): Promise<RequestLog[]> {
    return await RequestLog.findAll({
      where: { wasBlocked: true },
      order: [['timestamp', 'DESC']],
      limit,
    });
  }

  /**
   * Get recent logs
   */
  static async getRecent(limit = 100): Promise<RequestLog[]> {
    return await RequestLog.findAll({
      order: [['timestamp', 'DESC']],
      limit,
    });
  }
}

RequestLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: false,
      field: 'ip_address',
    },
    apiKeyId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'api_key_id',
    },
    tier: {
      type: DataTypes.ENUM(
        'anonymous',
        'free',
        'premium',
        'shopsync',
        'enderstorage',
        'worker',
        'internal',
      ),
      allowNull: false,
      defaultValue: 'anonymous',
    },
    wasBlocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'was_blocked',
    },
    blockReason: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'block_reason',
    },
  },
  {
    sequelize,
    tableName: 'request_logs',
    timestamps: false,
  },
);
