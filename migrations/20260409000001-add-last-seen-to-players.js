'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('players', 'lastSeenAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE players
      SET lastSeenAt = updatedAt
      WHERE lastSeenAt IS NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('players', 'lastSeenAt');
  },
};
