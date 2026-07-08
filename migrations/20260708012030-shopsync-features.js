'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('shops', 'featuresList', {
      type: Sequelize.TEXT,
      allowNull: true,
    })

    await queryInterface.addColumn('listings', 'featuresList', {
      type: Sequelize.TEXT,
      allowNull: true,
    })
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('shops', 'featuresList')
    await queryInterface.removeColumn('listings', 'featuresList')
  }
};
