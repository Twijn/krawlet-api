'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('transfers', 'status', {
      type: Sequelize.ENUM('pending', 'in_progress', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    });

    await queryInterface.addColumn('transfers', 'error', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('transfers', 'status');
    await queryInterface.removeColumn('transfers', 'error');
  },
};
