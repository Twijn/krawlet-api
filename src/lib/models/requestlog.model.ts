import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from './database';

export type RequestLogTier =
  | 'anonymous'
  | 'free'
  | 'premium'
  | 'shopsync'
  | 'enderstorage'
  | 'internal';

interface RequestLogAttributes {
  id: string;
  requestId: string;
  timestamp: Date;
  method: string;
  path: string;
  ipAddress: string;
  userAgent?: string;
  referer?: string;
  ccServer?: string;
  ccComputerId?: number;
  apiKeyId?: string;
  tier: RequestLogTier;
  rateLimitCount: number;
  rateLimitLimit: number;
  rateLimitRemaining: number;
  rateLimitResetAt: Date;
  wasBlocked: boolean;
  blockReason?: string;
  responseStatus?: number;
  responseTimeMs?: number;
  createdAt: Date;
}

interface RequestLogCreationAttributes
  extends Optional<
    RequestLogAttributes,
    | 'id'
    | 'timestamp'
    | 'createdAt'
    | 'userAgent'
    | 'referer'
    | 'ccServer'
    | 'ccComputerId'
    | 'apiKeyId'
    | 'blockReason'
    | 'responseStatus'
    | 'responseTimeMs'
  > {}

export class RequestLog
  extends Model<RequestLogAttributes, RequestLogCreationAttributes>
  implements RequestLogAttributes
{
  declare id: string;
  declare requestId: string;
  declare timestamp: Date;
  declare method: string;
  declare path: string;
  declare ipAddress: string;
  declare userAgent?: string;
  declare referer?: string;
  declare ccServer?: string;
  declare ccComputerId?: number;
  declare apiKeyId?: string;
  declare tier: RequestLogTier;
  declare rateLimitCount: number;
  declare rateLimitLimit: number;
  declare rateLimitRemaining: number;
  declare rateLimitResetAt: Date;
  declare wasBlocked: boolean;
  declare blockReason?: string;
  declare responseStatus?: number;
  declare responseTimeMs?: number;
  declare createdAt: Date;

  /**
   * Helper method to log a request
   */
  static async logRequest(
    data: Omit<RequestLogCreationAttributes, 'id' | 'timestamp' | 'createdAt'>,
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
    requestId: {
      type: DataTypes.STRING(36),
      allowNull: false,
      field: 'request_id',
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    method: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    path: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: false,
      field: 'ip_address',
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'user_agent',
    },
    referer: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'referer',
    },
    ccServer: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'cc_server',
    },
    ccComputerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'cc_computer_id',
    },
    apiKeyId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'api_key_id',
    },
    tier: {
      type: DataTypes.ENUM('anonymous', 'free', 'premium', 'shopsync', 'enderstorage', 'internal'),
      allowNull: false,
      defaultValue: 'anonymous',
    },
    rateLimitCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'rate_limit_count',
    },
    rateLimitLimit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'rate_limit_limit',
    },
    rateLimitRemaining: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'rate_limit_remaining',
    },
    rateLimitResetAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'rate_limit_reset_at',
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
    responseStatus: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'response_status',
    },
    responseTimeMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'response_time_ms',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'request_logs',
    timestamps: false,
  },
);
