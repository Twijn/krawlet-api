'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const indexes = await queryInterface.showIndex('api_keys');
    const uniqueMcUuidIndexes = indexes.filter(
      (index) =>
        index.unique === true &&
        index.fields.length === 1 &&
        index.fields[0].attribute === 'mc_uuid',
    );

    for (const index of uniqueMcUuidIndexes) {
      await queryInterface.removeIndex('api_keys', index.name);
    }
  },

  async down(queryInterface) {
    await queryInterface.addIndex('api_keys', ['mc_uuid'], {
      name: 'api_keys_mc_uuid_unique',
      unique: true,
    });
  },
};
