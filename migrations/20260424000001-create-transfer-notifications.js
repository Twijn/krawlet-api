'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('transfer_notifications', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      transferId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'transfers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      senderEntityId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      type: {
        type: Sequelize.ENUM('error', 'info', 'success'),
        allowNull: false,
        defaultValue: 'info',
      },
      message: {
        type: Sequelize.STRING(512),
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

    await queryInterface.addIndex('transfer_notifications', ['transferId']);
    await queryInterface.addIndex('transfer_notifications', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('transfer_notifications');
  },
};
