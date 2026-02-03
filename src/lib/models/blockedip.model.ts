import { Model, DataTypes, Op } from 'sequelize';
import { sequelize } from './database';

export type BlockLevel = 'app' | 'firewall';
export type TriggerType =
  | 'consecutive_429s'
  | 'sustained_traffic'
  | 'burst_traffic'
  | 'repeat_offender'
  | 'user_agent_cycling'
  | 'manual';

interface BlockedIpAttributes {
  id: string;
  ipAddress: string;
  blockLevel: BlockLevel;
  reason: string;
  triggerType: TriggerType;
  consecutive429Count: number | null;
  requestsPerSecond: number | null;
  userAgentCount: number | null;
  previousBlockCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  removedAt: Date | null;
  removedReason: string | null;
  lastSeenAt: Date | null;
  blockedRequestCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface BlockedIpCreationAttributes {
  ipAddress: string;
  blockLevel: BlockLevel;
  reason: string;
  triggerType: TriggerType;
  consecutive429Count?: number | null;
  requestsPerSecond?: number | null;
  userAgentCount?: number | null;
  previousBlockCount?: number;
  expiresAt?: Date | null;
}

export class BlockedIp
  extends Model<BlockedIpAttributes, BlockedIpCreationAttributes>
  implements BlockedIpAttributes
{
  public id!: string;
  public ipAddress!: string;
  public blockLevel!: BlockLevel;
  public reason!: string;
  public triggerType!: TriggerType;
  public consecutive429Count!: number | null;
  public requestsPerSecond!: number | null;
  public userAgentCount!: number | null;
  public previousBlockCount!: number;
  public expiresAt!: Date | null;
  public isActive!: boolean;
  public removedAt!: Date | null;
  public removedReason!: string | null;
  public lastSeenAt!: Date | null;
  public blockedRequestCount!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Check if this block is currently effective (active and not expired)
   */
  isEffective(): boolean {
    if (!this.isActive) return false;
    if (this.expiresAt && new Date() > this.expiresAt) return false;
    return true;
  }

  /**
   * Record a blocked request attempt
   */
  async recordBlockedRequest(): Promise<void> {
    this.lastSeenAt = new Date();
    this.blockedRequestCount += 1;
    await this.save();
  }

  /**
   * Remove this block
   */
  async remove(reason?: string): Promise<void> {
    this.isActive = false;
    this.removedAt = new Date();
    this.removedReason = reason || null;
    await this.save();
  }

  /**
   * Check if an IP is currently blocked
   */
  static async isBlocked(ipAddress: string): Promise<BlockedIp | null> {
    const now = new Date();
    const block = await BlockedIp.findOne({
      where: {
        ipAddress,
        isActive: true,
        [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
      },
      order: [['createdAt', 'DESC']],
    });
    return block;
  }

  /**
   * Get all active blocks
   */
  static async getActiveBlocks(level?: BlockLevel): Promise<BlockedIp[]> {
    const now = new Date();
    const where: any = {
      isActive: true,
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }],
    };
    if (level) where.blockLevel = level;

    return BlockedIp.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Get all firewall-level blocks for manual UFW blocking
   */
  static async getFirewallBlocks(): Promise<BlockedIp[]> {
    return BlockedIp.getActiveBlocks('firewall');
  }

  /**
   * Get block history for an IP
   */
  static async getHistory(ipAddress: string): Promise<BlockedIp[]> {
    return BlockedIp.findAll({
      where: { ipAddress },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Count previous blocks for an IP
   */
  static async getPreviousBlockCount(ipAddress: string): Promise<number> {
    return BlockedIp.count({
      where: { ipAddress },
    });
  }

  /**
   * Block an IP at app level (temporary)
   */
  static async blockAtAppLevel(
    ipAddress: string,
    reason: string,
    triggerType: TriggerType,
    durationMinutes: number = 30,
    metadata?: {
      consecutive429Count?: number;
      requestsPerSecond?: number;
      userAgentCount?: number;
    },
  ): Promise<BlockedIp> {
    const previousBlockCount = await BlockedIp.getPreviousBlockCount(ipAddress);
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    return BlockedIp.create({
      ipAddress,
      blockLevel: 'app',
      reason,
      triggerType,
      consecutive429Count: metadata?.consecutive429Count ?? null,
      requestsPerSecond: metadata?.requestsPerSecond ?? null,
      userAgentCount: metadata?.userAgentCount ?? null,
      previousBlockCount,
      expiresAt,
    });
  }

  /**
   * Escalate an IP to firewall level (for manual UFW blocking)
   */
  static async escalateToFirewall(
    ipAddress: string,
    reason: string,
    triggerType: TriggerType = 'repeat_offender',
  ): Promise<BlockedIp> {
    const previousBlockCount = await BlockedIp.getPreviousBlockCount(ipAddress);

    return BlockedIp.create({
      ipAddress,
      blockLevel: 'firewall',
      reason,
      triggerType,
      previousBlockCount,
      expiresAt: null, // Firewall blocks don't expire automatically
    });
  }

  /**
   * Manually block an IP
   */
  static async manualBlock(
    ipAddress: string,
    blockLevel: BlockLevel,
    reason: string,
    durationMinutes?: number,
  ): Promise<BlockedIp> {
    const previousBlockCount = await BlockedIp.getPreviousBlockCount(ipAddress);
    const expiresAt = durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null;

    return BlockedIp.create({
      ipAddress,
      blockLevel,
      reason,
      triggerType: 'manual',
      previousBlockCount,
      expiresAt,
    });
  }

  /**
   * Clean up expired blocks (mark as inactive)
   */
  static async cleanupExpired(): Promise<number> {
    const [affectedCount] = await BlockedIp.update(
      { isActive: false },
      {
        where: {
          isActive: true,
          expiresAt: { [Op.lt]: new Date() },
        },
      },
    );
    return affectedCount;
  }
}

BlockedIp.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: false,
      field: 'ip_address',
    },
    blockLevel: {
      type: DataTypes.ENUM('app', 'firewall'),
      allowNull: false,
      field: 'block_level',
    },
    reason: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    triggerType: {
      type: DataTypes.ENUM(
        'consecutive_429s',
        'sustained_traffic',
        'burst_traffic',
        'repeat_offender',
        'user_agent_cycling',
        'manual',
      ),
      allowNull: false,
      field: 'trigger_type',
    },
    consecutive429Count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'consecutive_429_count',
    },
    requestsPerSecond: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'requests_per_second',
    },
    userAgentCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_agent_count',
    },
    previousBlockCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'previous_block_count',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
    removedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'removed_at',
    },
    removedReason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'removed_reason',
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_seen_at',
    },
    blockedRequestCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'blocked_request_count',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'blocked_ips',
    modelName: 'BlockedIp',
  },
);

// Cleanup expired blocks every 5 minutes
setInterval(
  () => {
    BlockedIp.cleanupExpired().catch((err) =>
      console.error('Failed to cleanup expired blocks:', err),
    );
  },
  5 * 60 * 1000,
);
