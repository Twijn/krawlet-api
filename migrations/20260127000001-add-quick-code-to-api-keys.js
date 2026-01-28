'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('api_keys', 'qc_code', {
      type: Sequelize.STRING(6),
      allowNull: true,
      comment: 'Quick code - 6-digit code for easy key retrieval',
    });

    await queryInterface.addColumn('api_keys', 'qc_expires', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Expiration time for the quick code (typically 15 minutes)',
    });

    await queryInterface.addIndex('api_keys', ['qc_code'], {
      name: 'api_keys_qc_code_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('api_keys', 'api_keys_qc_code_idx');
    await queryInterface.removeColumn('api_keys', 'qc_code');
    await queryInterface.removeColumn('api_keys', 'qc_expires');
  },
};
