'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
      await queryInterface.removeColumn('listings', 'deletedAt');
  },

  async down (queryInterface, Sequelize) {
      await queryInterface.addColumn('listings', 'deletedAt', {
          type: Sequelize.DATE,
          allowNull: true
      });
  }
};
