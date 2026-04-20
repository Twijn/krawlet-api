'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('estorage_entities', 'entity_type', {
      type: Sequelize.ENUM('player', 'shop', 'service', 'public'),
      allowNull: false,
    });

    await queryInterface.sequelize.query(`
      UPDATE estorage_entities
      SET entity_type = 'public'
      WHERE entity_type = 'service'
        AND name REGEXP '^public:[0-9]+,[0-9]+,[0-9]+$'
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE estorage_entities
      SET entity_type = 'service'
      WHERE entity_type = 'public'
        AND name REGEXP '^public:[0-9]+,[0-9]+,[0-9]+$'
    `);

    await queryInterface.changeColumn('estorage_entities', 'entity_type', {
      type: Sequelize.ENUM('player', 'shop', 'service'),
      allowNull: false,
    });
  },
};
