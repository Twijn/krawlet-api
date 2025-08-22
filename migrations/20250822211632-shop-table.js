'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('shops', {
      id: {
        type: Sequelize.CHAR(20),
        primaryKey: true,
      },
      name: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      owner: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      computerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      softwareName: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      softwareVersion: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      locationCoordinates: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      locationDescription: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      locationDimension: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    await queryInterface.dropTable('shops');
  }
};
