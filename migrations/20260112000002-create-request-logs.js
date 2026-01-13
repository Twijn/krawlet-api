'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('request_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      request_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        comment: 'UUID from request tracking middleware',
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      method: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: 'HTTP method (GET, POST, etc.)',
      },
      path: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Request path',
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: false,
        comment: 'Client IP address (supports IPv6)',
      },
      user_agent: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'User-Agent header',
      },
      api_key_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'api_keys',
          key: 'id',
        },
        onDelete: 'SET NULL',
        comment: 'Associated API key if authenticated',
      },
      tier: {
        type: Sequelize.ENUM('anonymous', 'free', 'premium'),
        allowNull: false,
        defaultValue: 'anonymous',
        comment: 'Request tier level',
      },
      rate_limit_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Current request count in window',
      },
      rate_limit_limit: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Maximum requests allowed',
      },
      rate_limit_remaining: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Remaining requests in window',
      },
      rate_limit_reset_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When rate limit window resets',
      },
      was_blocked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether request was blocked (rate limit, auth failure)',
      },
      block_reason: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Reason for blocking (RATE_LIMIT_EXCEEDED, INVALID_API_KEY, etc.)',
      },
      response_status: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'HTTP response status code',
      },
      response_time_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Response time in milliseconds',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Indexes for common queries
    await queryInterface.addIndex('request_logs', ['timestamp'], {
      name: 'idx_request_logs_timestamp',
    });

    await queryInterface.addIndex('request_logs', ['api_key_id'], {
      name: 'idx_request_logs_api_key_id',
    });

    await queryInterface.addIndex('request_logs', ['ip_address'], {
      name: 'idx_request_logs_ip_address',
    });

    await queryInterface.addIndex('request_logs', ['was_blocked'], {
      name: 'idx_request_logs_was_blocked',
    });

    await queryInterface.addIndex('request_logs', ['request_id'], {
      name: 'idx_request_logs_request_id',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('request_logs');
  },
};
