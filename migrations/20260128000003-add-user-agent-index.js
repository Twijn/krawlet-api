'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Index for user_agent grouping queries
    await queryInterface.addIndex('request_logs', ['user_agent'], {
      name: 'idx_request_logs_user_agent',
    });

    // Composite index for user_agent with date filter
    await queryInterface.addIndex('request_logs', ['created_at', 'user_agent'], {
      name: 'idx_request_logs_created_at_user_agent',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_user_agent');
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_created_at_user_agent');
  },
};
