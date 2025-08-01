require("dotenv").config();

module.exports = {
  "development": {
    "url": process.env.DATABASE_URL,
    "dialect": "mariadb"
  },
  "test": {
    "url": process.env.DATABASE_URL,
    "dialect": "mariadb"
  },
  "production": {
    "url": process.env.DATABASE_URL,
    "dialect": "mariadb"
  }
}
