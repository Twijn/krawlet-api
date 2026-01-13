module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('api_keys', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: Sequelize.STRING(64),
        unique: true,
        allowNull: false,
        comment: 'API key (hashed)',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Friendly name for this key',
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'User email',
      },
      tier: {
        type: Sequelize.ENUM('free', 'premium'),
        defaultValue: 'free',
        allowNull: false,
      },
      rateLimit: {
        type: Sequelize.INTEGER,
        defaultValue: 1000,
        comment: 'Requests per hour',
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      lastUsedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      requestCount: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Total requests made with this key',
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

    await queryInterface.addIndex('api_keys', ['key']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('api_keys');
  },
};
