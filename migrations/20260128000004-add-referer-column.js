'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add referer column to request_logs
    await queryInterface.addColumn('request_logs', 'referer', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment: 'HTTP Referer header',
    });

    // Add index for referer queries
    await queryInterface.addIndex('request_logs', ['referer'], {
      name: 'idx_request_logs_referer',
    });

    // Composite index for referer with date filter
    await queryInterface.addIndex('request_logs', ['created_at', 'referer'], {
      name: 'idx_request_logs_created_at_referer',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_referer');
    await queryInterface.removeIndex('request_logs', 'idx_request_logs_created_at_referer');
    await queryInterface.removeColumn('request_logs', 'referer');
  },
};
