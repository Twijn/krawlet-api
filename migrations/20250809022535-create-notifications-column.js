'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn("players", "notifications", {
      type: Sequelize.STRING(1000),
      allowNull: false,
      defaultValue: "none",
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn("players", "notifications");
  }
};
