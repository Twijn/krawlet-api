'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('api_keys', 'tier', {
      type: Sequelize.ENUM('free', 'premium', 'shopsync', 'enderstorage', 'worker', 'internal'),
      defaultValue: 'free',
      allowNull: false,
    });

    await queryInterface.changeColumn('request_logs', 'tier', {
      type: Sequelize.ENUM(
        'anonymous',
        'free',
        'premium',
        'shopsync',
        'enderstorage',
        'worker',
        'internal',
      ),
      allowNull: false,
      defaultValue: 'anonymous',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('api_keys', 'tier', {
      type: Sequelize.ENUM('free', 'premium', 'shopsync', 'enderstorage', 'internal'),
      defaultValue: 'free',
      allowNull: false,
    });

    await queryInterface.changeColumn('request_logs', 'tier', {
      type: Sequelize.ENUM('anonymous', 'free', 'premium', 'shopsync', 'enderstorage', 'internal'),
      allowNull: false,
      defaultValue: 'anonymous',
    });
  },
};
