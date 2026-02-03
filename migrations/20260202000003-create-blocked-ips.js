module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('blocked_ips', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      ipAddress: {
        type: Sequelize.STRING(45),
        allowNull: false,
        field: 'ip_address',
        comment: 'Blocked IP address (supports IPv6)',
      },
      blockLevel: {
        type: Sequelize.ENUM('app', 'firewall'),
        allowNull: false,
        field: 'block_level',
        comment: 'app = temporary app-level block, firewall = recommend for UFW block',
      },
      reason: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Reason for the block',
      },
      triggerType: {
        type: Sequelize.ENUM(
          'consecutive_429s',
          'sustained_traffic',
          'burst_traffic',
          'repeat_offender',
          'user_agent_cycling',
          'manual',
        ),
        allowNull: false,
        field: 'trigger_type',
        comment: 'What triggered this block',
      },
      consecutive429Count: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'consecutive_429_count',
        comment: 'Number of consecutive 429s that triggered the block',
      },
      requestsPerSecond: {
        type: Sequelize.FLOAT,
        allowNull: true,
        field: 'requests_per_second',
        comment: 'Burst rate that triggered the block',
      },
      userAgentCount: {
        type: Sequelize.INTEGER,
        allowNull: true,
        field: 'user_agent_count',
        comment: 'Number of different user agents used (if cycling detected)',
      },
      previousBlockCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        field: 'previous_block_count',
        comment: 'How many times this IP has been blocked before',
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'expires_at',
        comment: 'When the block expires (null = permanent until manually removed)',
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
        comment: 'Whether this block is currently active',
      },
      removedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'removed_at',
        comment: 'When the block was manually removed',
      },
      removedReason: {
        type: Sequelize.STRING(500),
        allowNull: true,
        field: 'removed_reason',
        comment: 'Reason for removing the block',
      },
      lastSeenAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'last_seen_at',
        comment: 'Last time this IP tried to access while blocked',
      },
      blockedRequestCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        field: 'blocked_request_count',
        comment: 'How many requests were blocked since this block was created',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        field: 'updated_at',
      },
    });

    // Index for quick IP lookup
    await queryInterface.addIndex('blocked_ips', ['ip_address', 'is_active'], {
      name: 'idx_blocked_ips_ip_active',
    });

    // Index for finding active blocks
    await queryInterface.addIndex('blocked_ips', ['is_active', 'block_level'], {
      name: 'idx_blocked_ips_active_level',
    });

    // Index for finding expired blocks to clean up
    await queryInterface.addIndex('blocked_ips', ['expires_at'], {
      name: 'idx_blocked_ips_expires',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('blocked_ips');
  },
};
