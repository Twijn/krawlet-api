'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface) {
      await queryInterface.bulkDelete('listing_prices', null);
      await queryInterface.bulkDelete('listings', null);
  },

  async down (queryInterface, Sequelize) {
    // No way to revert this migration
  }
};
