'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('transfers', 'memo', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'itemNbt',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('transfers', 'memo');
  },
};
