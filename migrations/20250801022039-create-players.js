'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('players', {
      minecraftUUID: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
      },
      minecraftName: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      kromerAddress: {
        type: Sequelize.CHAR(10),
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('players');
  }
};
