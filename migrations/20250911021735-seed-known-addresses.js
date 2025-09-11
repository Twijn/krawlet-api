'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
      await queryInterface.bulkInsert('knownaddresses', [
          {
              id: crypto.randomUUID(),
              type: 'official',
              address: 'serverwelf',
              imageSrc: '/images/verified/serverwelf.png',
              name: 'ReconnectedCC',
              description: 'Verified as being the Kromer address for server welfare on reconnected.cc',
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'official',
              address: 'krb1yie41o',
              name: 'Soak',
              description: 'Verified as being the official address for Soak, see \\soak for more information',
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'ktwinfarm4',
              name: 'Twin Farm',
              description: "Official shop address for Twijn's Farm Store, located in /warp mall",
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'kquarryree',
              name: 'Twin Quarry',
              description: "Official shop address for Twijn's Quarry Store, located in /warp mall",
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'kfemstoree',
              name: 'Femcorp',
              description: 'Official shop address for Femcorp Store, located in /warp mall',
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'ksugarcane',
              name: "Sophie's General Store",
              description: "Official shop address for hartbreix's general store, located in /warp mall",
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'kromerluvr',
              name: "Sophie's Enchant Store",
              description: "Official shop address for hartbreix's enchant store, located in /warp mall",
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'krillionss',
              name: "Hellscaped's Store",
              description: "Official shop address for Hellscaped's store, located near /warp spawn",
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'kenchants0',
              name: "Emily's Enchant Store",
              description: "Official shop address for Emily's enchant store, located near /warp spawn",
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'k2god41s23',
              name: 'SolidityPools',
              description: 'Official shop address for Solidity Pools, located north of /warp spawn',
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'komgasdvaw',
              name: 'Galaxy Computing',
              description: 'Official shop address for Galaxy Computing, located in /warp mall',
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'kvillwkw05',
              name: "Chris's Shop",
              description: "Official shop address for Chris's Shop, located in /warp mall",
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'knvv4o6sbx',
              name: 'foxshop',
              description: 'Official shop address for foxshop, located west of /warp mall',
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'shop',
              address: 'kzzzzzz256',
              name: 'Z Shop',
              description: 'Official shop address for Z Shop, located outside of /warp mall',
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'gamble',
              address: 'kromerball',
              name: 'Kromer Ball',
              description: 'Official address for Kromer Ball, see \\kb for more information',
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'gamble',
              address: 'kromerflp0',
              name: 'Kromer Flip',
              description: 'Official address for Kromer Flip, see \\kf for more information',
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'gamble',
              address: 'kasinoslt5',
              name: "Emily's Slot Machine",
              description: "Official address for Emily's slot machine, located at -20 30",
              createdAt: new Date(),
              updatedAt: new Date()
          },
          {
              id: crypto.randomUUID(),
              type: 'company',
              address: 'kfemcorpio',
              name: 'Femcorp',
              description: 'Official wallet for Femcorp',
              createdAt: new Date(),
              updatedAt: new Date()
          }
      ]);
  },

  async down (queryInterface, Sequelize) {
      await queryInterface.bulkDelete('knownaddresses', null, {});
  }
};
