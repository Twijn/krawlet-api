'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new tier values to the request_logs tier enum
    await queryInterface.changeColumn('request_logs', 'tier', {
      type: Sequelize.ENUM('anonymous', 'free', 'premium', 'shopsync', 'enderstorage', 'internal'),
      allowNull: false,
      defaultValue: 'anonymous',
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to original tier values
    // Note: This will fail if any rows have shopsync/enderstorage/internal values
    await queryInterface.changeColumn('request_logs', 'tier', {
      type: Sequelize.ENUM('anonymous', 'free', 'premium'),
      allowNull: false,
      defaultValue: 'anonymous',
    });
  },
};
