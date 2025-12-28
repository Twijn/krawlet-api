'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Shop changes table (name, description, location, software, etc.)
    await queryInterface.createTable('shop_change_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      shopId: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      shopName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      field: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      previousValue: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      newValue: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      isNewShop: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.addIndex('shop_change_logs', ['shopId']);
    await queryInterface.addIndex('shop_change_logs', ['createdAt']);

    // Item change logs table (additions/removals)
    await queryInterface.createTable('item_change_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      shopId: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      shopName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      changeType: {
        type: Sequelize.ENUM('added', 'removed'),
        allowNull: false,
      },
      itemName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      itemDisplayName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      itemHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
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

    await queryInterface.addIndex('item_change_logs', ['shopId']);
    await queryInterface.addIndex('item_change_logs', ['changeType']);
    await queryInterface.addIndex('item_change_logs', ['createdAt']);

    // Price change logs table
    await queryInterface.createTable('price_change_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      shopId: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      shopName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      itemName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      itemDisplayName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      itemHash: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      field: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      previousValue: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      newValue: {
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
      },
    });

    await queryInterface.addIndex('price_change_logs', ['shopId']);
    await queryInterface.addIndex('price_change_logs', ['itemHash']);
    await queryInterface.addIndex('price_change_logs', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('price_change_logs');
    await queryInterface.dropTable('item_change_logs');
    await queryInterface.dropTable('shop_change_logs');
  },
};
