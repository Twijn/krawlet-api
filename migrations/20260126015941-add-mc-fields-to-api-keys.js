'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('api_keys', 'mc_uuid', {
      type: Sequelize.UUID,
      allowNull: true,
      unique: true,
      comment: 'Minecraft UUID of the player who generated this key (for chatbox-generated keys)',
    });

    await queryInterface.addColumn('api_keys', 'mc_name', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Minecraft name of the player at time of key generation',
    });

    await queryInterface.addIndex('api_keys', ['mc_uuid']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('api_keys', ['mc_uuid']);
    await queryInterface.removeColumn('api_keys', 'mc_uuid');
    await queryInterface.removeColumn('api_keys', 'mc_name');
  },
};
