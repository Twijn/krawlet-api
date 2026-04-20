'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('api_keys', 'estorage_entity_id', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Optional direct link from API key to an ender storage entity',
    });

    await queryInterface.addIndex('api_keys', ['estorage_entity_id'], {
      name: 'api_keys_estorage_entity_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('api_keys', 'api_keys_estorage_entity_id_idx');
    await queryInterface.removeColumn('api_keys', 'estorage_entity_id');
  },
};
