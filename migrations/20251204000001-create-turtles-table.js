'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('turtles', {
      id: {
        type: Sequelize.STRING(50),
        primaryKey: true,
      },
      label: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      relativeX: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      relativeY: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      relativeZ: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      absoluteX: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      absoluteY: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      absoluteZ: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      fuel: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('turtles');
  },
};
