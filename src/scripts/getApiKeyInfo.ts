#!/usr/bin/env node

/**
 * API Key Info CLI
 *
 * Usage:
 *   pnpm apikey-info -- --id <uuid>
 *   pnpm apikey-info -- --key <raw-key>
 *   pnpm apikey-info -- --name "My App"
 *   pnpm apikey-info -- --list
 */

import 'dotenv/config';
import { Op } from 'sequelize';
import { ApiKey } from '../lib/models/apikey.model';
import { RequestLog } from '../lib/models/requestlog.model';
import { sequelize } from '../lib/models/database';

interface GetKeyOptions {
  id?: string;
  key?: string;
  name?: string;
  list?: boolean;
  usage?: boolean;
}

async function getUsageStats(apiKeyId: string): Promise<{
  totalRequests: number;
  last24h: number;
  last7d: number;
  last30d: number;
  blockedRequests: number;
  avgResponseTime: number | null;
  topEndpoints: { path: string; count: number }[];
}> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalRequests, last24h, last7d, last30d, blockedRequests, avgResponseTime, topEndpoints] =
    await Promise.all([
      RequestLog.count({ where: { apiKeyId } }),
      RequestLog.count({ where: { apiKeyId, timestamp: { [Op.gte]: oneDayAgo } } }),
      RequestLog.count({ where: { apiKeyId, timestamp: { [Op.gte]: sevenDaysAgo } } }),
      RequestLog.count({ where: { apiKeyId, timestamp: { [Op.gte]: thirtyDaysAgo } } }),
      RequestLog.count({ where: { apiKeyId, wasBlocked: true } }),
      sequelize.query(
        `SELECT AVG(response_time_ms) as avgTime 
         FROM request_logs 
         WHERE api_key_id = :apiKeyId AND response_time_ms IS NOT NULL`,
        {
          replacements: { apiKeyId },
          type: 'SELECT',
        },
      ) as Promise<{ avgTime: number | null }[]>,
      sequelize.query(
        `SELECT path, COUNT(*) as count 
         FROM request_logs 
         WHERE api_key_id = :apiKeyId 
         GROUP BY path 
         ORDER BY count DESC 
         LIMIT 5`,
        {
          replacements: { apiKeyId },
          type: 'SELECT',
        },
      ) as Promise<{ path: string; count: number }[]>,
    ]);

  return {
    totalRequests,
    last24h,
    last7d,
    last30d,
    blockedRequests,
    avgResponseTime:
      avgResponseTime?.[0]?.avgTime != null
        ? Math.round(Number(avgResponseTime[0].avgTime) * 100) / 100
        : null,
    topEndpoints,
  };
}

async function displayApiKey(apiKey: ApiKey, showUsage: boolean): Promise<void> {
  console.log('\n------------------------------------------------------------------------');
  console.log('API Key Details:');
  console.log('------------------------------------------------------------------------');
  console.log(`   ID:            ${apiKey.id}`);
  console.log(`   Name:          ${apiKey.name}`);
  console.log(`   Email:         ${apiKey.email || 'N/A'}`);
  console.log(`   Tier:          ${apiKey.tier}`);
  console.log(`   Rate Limit:    ${apiKey.rateLimit} requests/hour`);
  console.log(`   Status:        ${apiKey.isActive ? 'Active' : 'Inactive'}`);
  console.log(`   Request Count: ${apiKey.requestCount.toLocaleString()}`);
  console.log(`   Last Used:     ${apiKey.lastUsedAt ? apiKey.lastUsedAt.toISOString() : 'Never'}`);
  console.log(`   Created:       ${apiKey.createdAt.toISOString()}`);
  console.log(`   Updated:       ${apiKey.updatedAt.toISOString()}`);

  if (showUsage) {
    console.log('\nUsage Statistics:');
    console.log('------------------------------------------------------------------------');

    const stats = await getUsageStats(apiKey.id);

    console.log(`   Total Requests:     ${stats.totalRequests.toLocaleString()}`);
    console.log(`   Last 24 hours:      ${stats.last24h.toLocaleString()}`);
    console.log(`   Last 7 days:        ${stats.last7d.toLocaleString()}`);
    console.log(`   Last 30 days:       ${stats.last30d.toLocaleString()}`);
    console.log(`   Blocked Requests:   ${stats.blockedRequests.toLocaleString()}`);
    console.log(
      `   Avg Response Time:  ${stats.avgResponseTime !== null ? `${stats.avgResponseTime}ms` : 'N/A'}`,
    );

    if (stats.topEndpoints.length > 0) {
      console.log('\n   Top Endpoints:');
      stats.topEndpoints.forEach((ep, i) => {
        console.log(`     ${i + 1}. ${ep.path} (${Number(ep.count).toLocaleString()} requests)`);
      });
    }
  }
  console.log();
}

async function listApiKeys(): Promise<void> {
  const apiKeys = await ApiKey.findAll({
    order: [['createdAt', 'DESC']],
  });

  if (apiKeys.length === 0) {
    console.log('\n📭 No API keys found.\n');
    return;
  }

  console.log(`\n📋 API Keys (${apiKeys.length} total):`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(
    `${'ID'.padEnd(38)} ${'Name'.padEnd(20)} ${'Tier'.padEnd(8)} ${'Status'.padEnd(8)} ${'Requests'.padEnd(12)}`,
  );
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const key of apiKeys) {
    const status = key.isActive ? '✅' : '❌';
    console.log(
      `${key.id.padEnd(38)} ${key.name.substring(0, 18).padEnd(20)} ${key.tier.padEnd(8)} ${status.padEnd(8)} ${key.requestCount.toLocaleString().padEnd(12)}`,
    );
  }
  console.log();
}

async function getApiKeyInfo(options: GetKeyOptions): Promise<void> {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('✓ Database connected');

    if (options.list) {
      await listApiKeys();
      await sequelize.close();
      process.exit(0);
      return;
    }

    let apiKey: ApiKey | null = null;

    if (options.id) {
      apiKey = await ApiKey.findByPk(options.id);
    } else if (options.key) {
      const hashedKey = ApiKey.hashKey(options.key);
      apiKey = await ApiKey.findOne({ where: { key: hashedKey } });
    } else if (options.name) {
      apiKey = await ApiKey.findOne({
        where: { name: { [Op.like]: `%${options.name}%` } },
      });
    }

    if (!apiKey) {
      console.error('\n❌ API key not found.\n');
      await sequelize.close();
      process.exit(1);
      return;
    }

    await displayApiKey(apiKey, options.usage !== false);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await sequelize.close();
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): GetKeyOptions {
  const args = process.argv.slice(2);
  const options: GetKeyOptions = {
    usage: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--id':
        if (!next) throw new Error('--id requires a value');
        options.id = next;
        i++;
        break;
      case '--key':
        if (!next) throw new Error('--key requires a value');
        options.key = next;
        i++;
        break;
      case '--name':
        if (!next) throw new Error('--name requires a value');
        options.name = next;
        i++;
        break;
      case '--list':
      case '-l':
        options.list = true;
        break;
      case '--no-usage':
        options.usage = false;
        break;
      case '--help':
      case '-h':
        console.log(`
API Key Info

Usage:
  pnpm apikey-info -- --id <uuid>
  pnpm apikey-info -- --key <raw-key>
  pnpm apikey-info -- --name "My App"
  pnpm apikey-info -- --list

Lookup Options (one required unless using --list):
  --id <uuid>           Lookup by API key ID (UUID)
  --key <raw-key>       Lookup by raw API key (kraw_...)
  --name <string>       Lookup by name (partial match)

List Options:
  --list, -l            List all API keys

Other Options:
  --no-usage            Skip fetching detailed usage statistics
  --help, -h            Show this help message

Examples:
  pnpm apikey-info -- --list
  pnpm apikey-info -- --id "abc123-..."
  pnpm apikey-info -- --key "kraw_abc123..."
  pnpm apikey-info -- --name "My App"
  pnpm apikey-info -- --id "abc123-..." --no-usage
        `);
        process.exit(0);
        break;
    }
  }

  if (!options.list && !options.id && !options.key && !options.name) {
    throw new Error(
      'One of --id, --key, --name, or --list is required. Use --help for more information.',
    );
  }

  return options;
}

// Main execution
try {
  const options = parseArgs();
  getApiKeyInfo(options);
} catch (error) {
  if (error instanceof Error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    console.log('Use --help for usage information.\n');
  }
  process.exit(1);
}
