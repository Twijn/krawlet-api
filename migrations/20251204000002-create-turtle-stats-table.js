'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('turtle_stats', {
      turtleId: {
        type: Sequelize.STRING(50),
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'turtles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      statName: {
        type: Sequelize.STRING(100),
        primaryKey: true,
        allowNull: false,
      },
      statValue: {
        type: Sequelize.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
    });

    // Add index for faster lookups by turtle
    await queryInterface.addIndex('turtle_stats', ['turtleId']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('turtle_stats');
  },
};
