'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn('players', 'estorageColorA');
    await queryInterface.removeColumn('players', 'estorageColorB');
    await queryInterface.removeColumn('players', 'estorageColorC');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('players', 'estorageColorA', {
      type: Sequelize.SMALLINT.UNSIGNED,
      allowNull: true,
    });

    await queryInterface.addColumn('players', 'estorageColorB', {
      type: Sequelize.SMALLINT.UNSIGNED,
      allowNull: true,
    });

    await queryInterface.addColumn('players', 'estorageColorC', {
      type: Sequelize.SMALLINT.UNSIGNED,
      allowNull: true,
    });
  },
};
