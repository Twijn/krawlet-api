'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.bulkInsert('knownaddresses', [
        {
            id: crypto.randomUUID(),
            type: 'official',
            address: 'kkrawletii',
            imageSrc: '/favicon-96x96.png',
            name: 'Krawlet',
            description: 'Verified as being the Kromer address for the Krawlet web wallet',
            createdAt: new Date(),
            updatedAt: new Date()
        },
    ])
  },

  async down (queryInterface, Sequelize) {
      await queryInterface.bulkDelete('knownaddresses', {
          address: 'kkrawletii'
      });
  }
};
