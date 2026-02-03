'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Covering index for IP details - path grouping query
    // Query: SELECT path, COUNT(*) FROM request_logs WHERE ip_address = :ip AND created_at >= ... GROUP BY path
    // Index order: (ip_address, created_at, path) allows filtering by ip + date, then covers path for grouping
    await queryInterface.addIndex('request_logs', ['ip_address', 'created_at', 'path'], {
      name: 'idx_request_logs_ip_created_path_covering',
    });

    // Covering index for IP details - user_agent grouping query
    // Query: SELECT user_agent, COUNT(*) FROM request_logs WHERE ip_address = :ip AND created_at >= ... GROUP BY user_agent
    // Index order: (ip_address, created_at, user_agent) allows filtering by ip + date, then covers user_agent for grouping
    await queryInterface.addIndex('request_logs', ['ip_address', 'created_at', 'user_agent'], {
      name: 'idx_request_logs_ip_created_ua_covering',
    });

    // Remove the old less-optimal index (ip_address, path, created_at has wrong column order)
    // The new idx_request_logs_ip_created_path_covering is better ordered for the filter pattern
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_ip_path_created_at');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the new covering indexes
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_ip_created_path_covering');
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_ip_created_ua_covering');

    // Restore the old index
    await queryInterface.addIndex('request_logs', ['ip_address', 'path', 'created_at'], {
      name: 'idx_request_logs_ip_path_created_at',
    });
  },
};
