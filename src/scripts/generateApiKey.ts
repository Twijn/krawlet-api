#!/usr/bin/env node

/**
 * API Key Generator CLI
 *
 * Usage:
 *   npm run gen-apikey -- --name "My App" --email "user@example.com" --tier free
 *   npm run gen-apikey -- --name "Premium User" --tier premium --limit 5000
 *   npm run gen-apikey -- --name "ShopSync Client" --tier shopsync
 *   npm run gen-apikey -- --name "Ender Storage" --tier enderstorage
 */

import 'dotenv/config';
import { ApiKey, ApiKeyTier } from '../lib/models/apikey.model';
import { sequelize } from '../lib/models/database';

const VALID_TIERS: ApiKeyTier[] = ['free', 'premium', 'shopsync', 'enderstorage', 'internal'];

interface GenerateKeyOptions {
  name: string;
  email?: string;
  tier?: ApiKeyTier;
  rateLimit?: number;
}

async function generateApiKey(options: GenerateKeyOptions): Promise<void> {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✓ Database connected');

    // Generate the key
    const rawKey = ApiKey.generateKey();
    const hashedKey = ApiKey.hashKey(rawKey);

    // Determine rate limit based on tier
    const defaultLimit = options.tier === 'premium' ? 5000 : 1000;
    const rateLimit = options.rateLimit || defaultLimit;

    // Create the API key record
    const apiKey = await ApiKey.create({
      key: hashedKey,
      name: options.name,
      email: options.email || null,
      tier: options.tier || 'free',
      rateLimit: rateLimit,
      isActive: true,
    });

    console.log('\n API Key Generated Successfully!\n');
    console.log('------------------------------------------------------------------------');
    console.log('API KEY (save this - it will not be shown again):');
    console.log(`   ${rawKey}`);
    console.log('------------------------------------------------------------------------');
    console.log('\nDetails:');
    console.log(`   ID:         ${apiKey.id}`);
    console.log(`   Name:       ${apiKey.name}`);
    console.log(`   Email:      ${apiKey.email || 'N/A'}`);
    console.log(`   Tier:       ${apiKey.tier}`);
    console.log(`   Rate Limit: ${apiKey.rateLimit} requests/hour`);
    console.log(`   Status:     Active`);
    console.log(`   Created:    ${apiKey.createdAt.toISOString()}`);
    console.log('\nUsage:');

    if (apiKey.tier === 'free' || apiKey.tier === 'premium') {
      console.log(
        '   curl -H "Authorization: Bearer ' + rawKey + '" http://localhost:3000/v1/players',
      );
    } else if (apiKey.tier === 'shopsync') {
      console.log(
        '   curl -X POST -H "Authorization: Bearer ' +
          rawKey +
          '" -H "Content-Type: application/json" -d @shop.json http://localhost:3000/v1/shops',
      );
    } else if (apiKey.tier === 'enderstorage') {
      console.log(
        '   curl -X POST -H "Authorization: Bearer ' +
          rawKey +
          '" -H "Content-Type: application/json" -d @storage.json http://localhost:3000/v1/storage',
      );
    } else {
      console.log('   This is an internal key with access to all protected endpoints.');
    }

    console.log('\nIMPORTANT: Store this key securely. The raw key cannot be retrieved later.\n');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Error generating API key:', error);
    await sequelize.close();
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): GenerateKeyOptions {
  const args = process.argv.slice(2);
  const options: GenerateKeyOptions = {
    name: '',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--name':
        if (!next) throw new Error('--name requires a value');
        options.name = next;
        i++;
        break;
      case '--email':
        if (!next) throw new Error('--email requires a value');
        options.email = next;
        i++;
        break;
      case '--tier':
        if (!next) throw new Error('--tier requires a value');
        if (!VALID_TIERS.includes(next as ApiKeyTier)) {
          throw new Error(`--tier must be one of: ${VALID_TIERS.join(', ')}`);
        }
        options.tier = next as ApiKeyTier;
        i++;
        break;
      case '--limit':
        if (!next) throw new Error('--limit requires a value');
        options.rateLimit = parseInt(next, 10);
        if (isNaN(options.rateLimit) || options.rateLimit < 1) {
          throw new Error('--limit must be a positive number');
        }
        i++;
        break;
      case '--help':
      case '-h':
        console.log(`
API Key Generator

Usage:
  npm run gen-apikey -- --name "My App" [options]

Required:
  --name <string>       Name/description for the API key

Optional:
  --email <string>      Email address associated with the key
  --tier <tier>         API key tier (default: free)
  --limit <number>      Custom rate limit per hour (default: 1000 for free, 5000 for premium)
  --help, -h            Show this help message

Tiers:
  free         - Standard API access, 1,000 requests/hour (default)
  premium      - Standard API access, 5,000 requests/hour (default)
  shopsync     - Access to POST /v1/shops for shop data synchronization
  enderstorage - Access to POST /v1/storage for ender storage data
  internal     - Full access to all protected internal endpoints

Examples:
  npm run gen-apikey -- --name "Test App"
  npm run gen-apikey -- --name "My App" --email "user@example.com"
  npm run gen-apikey -- --name "Premium User" --tier premium
  npm run gen-apikey -- --name "ShopSync Client" --tier shopsync
  npm run gen-apikey -- --name "Ender Storage Sync" --tier enderstorage
  npm run gen-apikey -- --name "Internal Service" --tier internal
        `);
        process.exit(0);
        break;
    }
  }

  if (!options.name) {
    throw new Error('--name is required. Use --help for more information.');
  }

  return options;
}

// Main execution
try {
  const options = parseArgs();
  generateApiKey(options);
} catch (error) {
  if (error instanceof Error) {
    console.error(`\nError: ${error.message}\n`);
    console.log('Use --help for usage information.\n');
  }
  process.exit(1);
}
