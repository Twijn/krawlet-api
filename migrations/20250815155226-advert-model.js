'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('adverts', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      playerUUID: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
      },
      content: {
        type: Sequelize.STRING(256),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM,
        values: ["active", "cancelled", "expired"],
        defaultValue: "active",
        allowNull: false,
      },
    });
  },

  async down (queryInterface) {
    await queryInterface.dropTable('adverts');
  }
};
