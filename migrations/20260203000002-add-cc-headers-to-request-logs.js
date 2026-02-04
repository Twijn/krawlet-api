'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add CC (ComputerCraft) specific header columns
    await queryInterface.addColumn('request_logs', 'cc_server', {
      type: Sequelize.STRING(255),
      allowNull: true,
      field: 'cc_server',
      comment: 'ComputerCraft server identifier from x-cc-srv header',
    });

    await queryInterface.addColumn('request_logs', 'cc_computer_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      field: 'cc_computer_id',
      comment: 'ComputerCraft computer ID from x-cc-id header',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('request_logs', 'cc_server');
    await queryInterface.removeColumn('request_logs', 'cc_computer_id');
  },
};
