'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
      await queryInterface.changeColumn('listing_prices', 'value', {
          type: Sequelize.DECIMAL(15, 3)
      });
  },

  async down (queryInterface, Sequelize) {
      await queryInterface.changeColumn('listing_prices', 'value', {
          type: Sequelize.DECIMAL(15, 2)
      });
  }
};
