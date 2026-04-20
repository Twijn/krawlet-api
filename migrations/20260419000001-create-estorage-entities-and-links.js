'use strict';

const { randomUUID } = require('crypto');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('estorage_entities', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      entity_type: {
        type: Sequelize.ENUM('player', 'shop', 'service'),
        allowNull: false,
      },
      color_a: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
      },
      color_b: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
      },
      color_c: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
      },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('estorage_entities', ['color_a', 'color_b', 'color_c'], {
      unique: true,
      name: 'estorage_entities_color_unique',
    });

    await queryInterface.addIndex('estorage_entities', ['entity_type', 'name'], {
      name: 'estorage_entities_type_name_idx',
    });

    await queryInterface.createTable('estorage_entity_links', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      entity_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'estorage_entities',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      link_type: {
        type: Sequelize.ENUM('player_uuid', 'shop_computer_id', 'public_frequency'),
        allowNull: false,
      },
      link_value: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      link_name: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('estorage_entity_links', ['link_type', 'link_value'], {
      unique: true,
      name: 'estorage_entity_links_type_value_unique',
    });

    await queryInterface.addIndex('estorage_entity_links', ['entity_id'], {
      name: 'estorage_entity_links_entity_idx',
    });

    const [players] = await queryInterface.sequelize.query(`
      SELECT minecraftUUID, minecraftName, estorageColorA, estorageColorB, estorageColorC
      FROM players
      WHERE estorageColorA IS NOT NULL
        AND estorageColorB IS NOT NULL
        AND estorageColorC IS NOT NULL
    `);

    if (!Array.isArray(players) || players.length === 0) {
      return;
    }

    const now = new Date();
    const entities = [];
    const links = [];

    for (const player of players) {
      const entityId = randomUUID();
      const name = typeof player.minecraftName === 'string' ? player.minecraftName : null;
      const uuid = typeof player.minecraftUUID === 'string' ? player.minecraftUUID : null;

      if (!name || !uuid) {
        continue;
      }

      entities.push({
        id: entityId,
        name,
        entity_type: 'player',
        color_a: player.estorageColorA,
        color_b: player.estorageColorB,
        color_c: player.estorageColorC,
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      links.push({
        id: randomUUID(),
        entity_id: entityId,
        link_type: 'player_uuid',
        link_value: uuid,
        link_name: name,
        is_primary: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (entities.length > 0) {
      await queryInterface.bulkInsert('estorage_entities', entities);
      await queryInterface.bulkInsert('estorage_entity_links', links);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('estorage_entity_links');
    await queryInterface.dropTable('estorage_entities');

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_estorage_entity_links_link_type";',
    );
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_estorage_entities_entity_type";',
    );
  },
};
