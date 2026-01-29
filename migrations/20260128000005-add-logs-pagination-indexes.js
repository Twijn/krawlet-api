'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Composite index for IP address + created_at DESC (for paginated IP searches)
    await queryInterface.addIndex('request_logs', ['ip_address', 'created_at'], {
      name: 'idx_request_logs_ip_address_created_at_desc',
      // MySQL will use this for both equality on ip_address and ordering by created_at
    });

    // Composite index for path prefix searches + created_at
    await queryInterface.addIndex('request_logs', ['path', 'created_at'], {
      name: 'idx_request_logs_path_created_at',
    });

    // Composite index for was_blocked filter + created_at (for filtered log views)
    await queryInterface.addIndex('request_logs', ['was_blocked', 'created_at'], {
      name: 'idx_request_logs_was_blocked_created_at',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_ip_address_created_at_desc');
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_path_created_at');
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_was_blocked_created_at');
  },
};
