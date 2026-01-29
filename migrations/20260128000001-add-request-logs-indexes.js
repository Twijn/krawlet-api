'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add index on path for "hits by path" queries
    await queryInterface.addIndex('request_logs', ['path'], {
      name: 'idx_request_logs_path',
    });

    // Add composite index for created_at + path (used in time-filtered path queries)
    await queryInterface.addIndex('request_logs', ['created_at', 'path'], {
      name: 'idx_request_logs_created_at_path',
    });

    // Add composite index for created_at + was_blocked (used in stats queries)
    await queryInterface.addIndex('request_logs', ['created_at', 'was_blocked'], {
      name: 'idx_request_logs_created_at_was_blocked',
    });

    // Add composite index for created_at + tier (used in tier chart)
    await queryInterface.addIndex('request_logs', ['created_at', 'tier'], {
      name: 'idx_request_logs_created_at_tier',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_path');
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_created_at_path');
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_created_at_was_blocked');
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_created_at_tier');
  },
};
