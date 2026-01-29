'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Composite index for IP + created_at (for "requests by IP" with date filter)
    await queryInterface.addIndex('request_logs', ['ip_address', 'created_at'], {
      name: 'idx_request_logs_ip_created_at',
    });

    // Composite index for IP + path + created_at (for IP breakdown by path)
    await queryInterface.addIndex('request_logs', ['ip_address', 'path', 'created_at'], {
      name: 'idx_request_logs_ip_path_created_at',
    });

    // Better index for the stats query - covering index for 24h requests count
    // The created_at index already exists, but we need it optimized for COUNT queries
    // Adding a partial index concept via composite with id for faster counting
    await queryInterface.addIndex('request_logs', ['created_at', 'id'], {
      name: 'idx_request_logs_created_at_id',
    });

    // Index for api_keys isActive filter (used in stats)
    await queryInterface.addIndex('api_keys', ['isActive'], {
      name: 'idx_api_keys_is_active',
    });

    // Index for api_keys requestCount ordering (used in most active query)
    await queryInterface.addIndex('api_keys', ['requestCount'], {
      name: 'idx_api_keys_request_count',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_ip_created_at');
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_ip_path_created_at');
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_created_at_id');
    await queryInterface.removeIndex('api_keys', 'idx_api_keys_is_active');
    await queryInterface.removeIndex('api_keys', 'idx_api_keys_request_count');
  },
};
