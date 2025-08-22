'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('listing_prices', {
      id: {
        type: Sequelize.CHAR(36),
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      listingId: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: {
          model: 'listings',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      value: {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: false,
      },
      currency: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      address: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      requiredMeta: {
        type: Sequelize.STRING,
        allowNull: true,
      },
    });

    // Add index on listingId for better query performance
    await queryInterface.addIndex('listing_prices', ['listingId']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('listing_prices');
  }
};
