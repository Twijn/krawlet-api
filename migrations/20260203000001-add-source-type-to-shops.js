'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add sourceType column to shops table
    // Tracks whether shop was added by radio tower or modem (default: modem)
    await queryInterface.addColumn('shops', 'source_type', {
      type: Sequelize.ENUM('modem', 'radio_tower'),
      allowNull: false,
      defaultValue: 'modem',
      comment: 'How the shop was added (modem = direct connection, radio_tower = CC: Radio Tower)',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('shops', 'source_type');
    // Clean up the ENUM type
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_shops_source_type";');
  },
};
