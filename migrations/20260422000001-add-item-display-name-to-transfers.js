'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('transfers', 'itemDisplayName', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    const [rows] = await queryInterface.sequelize.query(
      "SELECT id, itemName FROM transfers WHERE itemName IS NOT NULL AND (itemDisplayName IS NULL OR itemDisplayName = '')",
    );

    const toDisplayName = (itemName) => {
      if (!itemName || typeof itemName !== 'string') {
        return null;
      }

      const rawName = itemName.includes(':') ? itemName.split(':').pop() : itemName;
      if (!rawName) {
        return null;
      }

      return rawName
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    for (const row of rows) {
      const itemDisplayName = toDisplayName(row.itemName);
      if (!itemDisplayName) {
        continue;
      }

      await queryInterface.sequelize.query(
        'UPDATE transfers SET itemDisplayName = :itemDisplayName WHERE id = :id',
        {
          replacements: {
            itemDisplayName,
            id: row.id,
          },
        },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('transfers', 'itemDisplayName');
  },
};
