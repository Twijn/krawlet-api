'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('listings', {
      id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      shopId: {
        type: Sequelize.CHAR(20),
        allowNull: false,
        references: {
          model: 'shops',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      hash: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
      },
      itemName: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      itemNbt: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      itemDisplayName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      itemDescription: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      dynamicPrice: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      madeOnDemand: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      requiresInteraction: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Add index on shopId for better query performance
    await queryInterface.addIndex('listings', ['shopId']);
    // Add index on hash for better query performance
    await queryInterface.addIndex('listings', ['hash']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('listings');
  }
};
