'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('transfers', 'timeout', {
      type: Sequelize.DECIMAL(3, 1), // Allows values like 0.5, 1.0, 30.0
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('transfers', 'timeout');
  },
};
