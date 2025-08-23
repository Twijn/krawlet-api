'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn("listings", "shopBuysItem", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });

    await queryInterface.addColumn("listings", "noLimit", {
        type: Sequelize.BOOLEAN,
        allowNull: true
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn("listings", "shopBuysItem");
    await queryInterface.removeColumn("listings", "noLimit");
  }
};
