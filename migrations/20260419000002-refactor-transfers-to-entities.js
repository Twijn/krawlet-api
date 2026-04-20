'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.dropTable('transfers');

    await queryInterface.createTable('transfers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      workerId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      fromEntityId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      fromName: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      toEntityId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      toName: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      itemName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      itemNbt: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      quantityTransferred: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      timeout: {
        type: Sequelize.DECIMAL(3, 1),
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

    await queryInterface.addIndex('transfers', ['fromEntityId']);
    await queryInterface.addIndex('transfers', ['toEntityId']);
    await queryInterface.addIndex('transfers', ['status']);
    await queryInterface.addIndex('transfers', ['createdAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('transfers');

    await queryInterface.createTable('transfers', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'in_progress', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending',
      },
      error: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      workerId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      fromUUID: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      fromUsername: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      toUUID: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      toUsername: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      itemName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      itemNbt: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      quantityTransferred: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      timeout: {
        type: Sequelize.DECIMAL(3, 1),
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

    await queryInterface.addIndex('transfers', ['fromUUID']);
    await queryInterface.addIndex('transfers', ['toUUID']);
    await queryInterface.addIndex('transfers', ['status']);
    await queryInterface.addIndex('transfers', ['createdAt']);
  },
};
