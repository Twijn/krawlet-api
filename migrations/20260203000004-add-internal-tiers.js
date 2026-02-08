'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // MySQL/MariaDB: Modify the ENUM column to add new values
    await queryInterface.changeColumn('api_keys', 'tier', {
      type: Sequelize.ENUM('free', 'premium', 'shopsync', 'enderstorage', 'internal'),
      defaultValue: 'free',
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to original enum values (will fail if any rows use the new values)
    await queryInterface.changeColumn('api_keys', 'tier', {
      type: Sequelize.ENUM('free', 'premium'),
      defaultValue: 'free',
      allowNull: false,
    });
  },
};
