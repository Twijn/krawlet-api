'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const removeIndexIfExists = async (name) => {
      try {
        await queryInterface.removeIndex('request_logs', name);
      } catch {
        // Ignore missing indexes to support partially-migrated databases.
      }
    };

    // Remove indexes tied to dropped analytics/admin columns.
    await removeIndexIfExists('idx_request_logs_request_id');
    await removeIndexIfExists('idx_request_logs_user_agent');
    await removeIndexIfExists('idx_request_logs_created_at_user_agent');
    await removeIndexIfExists('idx_request_logs_referer');
    await removeIndexIfExists('idx_request_logs_created_at_referer');
    await removeIndexIfExists('idx_request_logs_ip_created_at');
    await removeIndexIfExists('idx_request_logs_ip_path_created_at');
    await removeIndexIfExists('idx_request_logs_created_at_id');
    await removeIndexIfExists('idx_request_logs_ip_address_created_at_desc');
    await removeIndexIfExists('idx_request_logs_path_created_at');
    await removeIndexIfExists('idx_request_logs_was_blocked_created_at');
    await removeIndexIfExists('idx_request_logs_ip_created_path_covering');
    await removeIndexIfExists('idx_request_logs_ip_created_ua_covering');
    await removeIndexIfExists('idx_request_logs_created_at_ip_address');

    await queryInterface.removeColumn('request_logs', 'request_id');
    await queryInterface.removeColumn('request_logs', 'method');
    await queryInterface.removeColumn('request_logs', 'path');
    await queryInterface.removeColumn('request_logs', 'user_agent');
    await queryInterface.removeColumn('request_logs', 'referer');
    await queryInterface.removeColumn('request_logs', 'cc_server');
    await queryInterface.removeColumn('request_logs', 'cc_computer_id');
    await queryInterface.removeColumn('request_logs', 'rate_limit_count');
    await queryInterface.removeColumn('request_logs', 'rate_limit_limit');
    await queryInterface.removeColumn('request_logs', 'rate_limit_remaining');
    await queryInterface.removeColumn('request_logs', 'rate_limit_reset_at');
    await queryInterface.removeColumn('request_logs', 'response_status');
    await queryInterface.removeColumn('request_logs', 'response_time_ms');
    await queryInterface.removeColumn('request_logs', 'created_at');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('request_logs', 'request_id', {
      type: Sequelize.STRING(36),
      allowNull: false,
      defaultValue: 'unknown',
      comment: 'UUID from request tracking middleware',
    });

    await queryInterface.addColumn('request_logs', 'method', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'GET',
      comment: 'HTTP method (GET, POST, etc.)',
    });

    await queryInterface.addColumn('request_logs', 'path', {
      type: Sequelize.STRING(500),
      allowNull: false,
      defaultValue: '/',
      comment: 'Request path',
    });

    await queryInterface.addColumn('request_logs', 'user_agent', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'User-Agent header',
    });

    await queryInterface.addColumn('request_logs', 'referer', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'HTTP Referer header',
    });

    await queryInterface.addColumn('request_logs', 'cc_server', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'CC server header value',
    });

    await queryInterface.addColumn('request_logs', 'cc_computer_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'CC computer id header value',
    });

    await queryInterface.addColumn('request_logs', 'rate_limit_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Current request count in window',
    });

    await queryInterface.addColumn('request_logs', 'rate_limit_limit', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 100,
      comment: 'Maximum requests allowed',
    });

    await queryInterface.addColumn('request_logs', 'rate_limit_remaining', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Remaining requests in window',
    });

    await queryInterface.addColumn('request_logs', 'rate_limit_reset_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
      comment: 'When rate limit window resets',
    });

    await queryInterface.addColumn('request_logs', 'response_status', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'HTTP response status code',
    });

    await queryInterface.addColumn('request_logs', 'response_time_ms', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Response time in milliseconds',
    });

    await queryInterface.addColumn('request_logs', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW,
    });

    await queryInterface.addIndex('request_logs', ['request_id'], {
      name: 'idx_request_logs_request_id',
    });
  },
};
