'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ==========================================================================
    // Covering indexes for chart aggregation queries
    // All these queries filter by created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    // then GROUP BY a column. Putting created_at first allows range scan,
    // then the grouped column allows index-only aggregation.
    // ==========================================================================

    // For /api/charts/ips: GROUP BY ip_address WHERE created_at >= ...
    // Need (created_at, ip_address) for covering index
    // Existing idx_request_logs_ip_created_at is (ip_address, created_at) - wrong order for this query
    await queryInterface.addIndex('request_logs', ['created_at', 'ip_address'], {
      name: 'idx_request_logs_created_at_ip_address',
    });

    // Note: The following indexes already exist and should work:
    // - idx_request_logs_created_at_user_agent: (created_at, user_agent) for /api/charts/useragents
    // - idx_request_logs_created_at_referer: (created_at, referer) for /api/charts/referers
    // - idx_request_logs_created_at_path: (created_at, path) for /api/charts/paths
    // - idx_request_logs_was_blocked_created_at: (was_blocked, created_at) for blocked queries
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_created_at_ip_address');
  },
};
