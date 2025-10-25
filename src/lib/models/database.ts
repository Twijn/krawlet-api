import { Sequelize } from 'sequelize';

// Handle missing DATABASE_URL for command deployment scenarios
const databaseUrl = process.env.DATABASE_URL || 'mysql://dummy:dummy@localhost:3306/dummy';

export const sequelize = new Sequelize(databaseUrl, {
  dialect: 'mariadb',
  logging: false,
});
