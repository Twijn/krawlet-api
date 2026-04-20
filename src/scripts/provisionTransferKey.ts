#!/usr/bin/env node

import 'dotenv/config';
import { Transaction } from 'sequelize';
import { ApiKey, ApiKeyTier } from '../lib/models/apikey.model';
import { sequelize } from '../lib/models/database';
import { EstorageEntity, VALID_COLORS } from '../lib/models/estorageentity.model';
import { EstorageEntityLink } from '../lib/models/estoragelink.model';

type TargetType = 'shop' | 'service';

type ProvisionOptions = {
  keyName: string;
  targetType: TargetType;
  colors: [number, number, number];
  tier: ApiKeyTier;
  rateLimit?: number;
  email?: string;
  entityName?: string;
  shopComputerId?: number;
};

const VALID_TIERS: ApiKeyTier[] = [
  'free',
  'premium',
  'shopsync',
  'enderstorage',
  'worker',
  'internal',
];

function defaultRateLimitForTier(tier: ApiKeyTier): number {
  if (tier === 'premium') {
    return 5000;
  }

  return 1000;
}

function parseColors(raw: string): [number, number, number] {
  const parts = raw
    .split(',')
    .map((p) => Number(p.trim()))
    .filter((n) => !Number.isNaN(n));

  if (parts.length !== 3) {
    throw new Error('--colors must contain exactly 3 comma-separated values');
  }

  const colors = parts as [number, number, number];
  const invalid = colors.find((c) => !VALID_COLORS.includes(c));
  if (invalid !== undefined) {
    throw new Error(`Invalid color value ${invalid}. Valid values: ${VALID_COLORS.join(', ')}`);
  }

  return colors;
}

function parseArgs(): ProvisionOptions {
  const args = process.argv.slice(2);

  let keyName: string | undefined;
  let targetType: TargetType | undefined;
  let colorsRaw: string | undefined;
  let tier: ApiKeyTier = 'premium';
  let rateLimit: number | undefined;
  let email: string | undefined;
  let entityName: string | undefined;
  let shopComputerId: number | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--name':
        if (!next) throw new Error('--name requires a value');
        keyName = next;
        i++;
        break;
      case '--type':
        if (!next) throw new Error('--type requires a value (shop|service)');
        if (next !== 'shop' && next !== 'service') {
          throw new Error('--type must be either shop or service');
        }
        targetType = next;
        i++;
        break;
      case '--colors':
        if (!next) throw new Error('--colors requires a value like 1,2,4');
        colorsRaw = next;
        i++;
        break;
      case '--tier':
        if (!next) throw new Error('--tier requires a value');
        if (!VALID_TIERS.includes(next as ApiKeyTier)) {
          throw new Error(`--tier must be one of: ${VALID_TIERS.join(', ')}`);
        }
        tier = next as ApiKeyTier;
        i++;
        break;
      case '--limit':
        if (!next) throw new Error('--limit requires a positive integer value');
        rateLimit = Number(next);
        if (!Number.isInteger(rateLimit) || rateLimit < 1) {
          throw new Error('--limit must be a positive integer');
        }
        i++;
        break;
      case '--email':
        if (!next) throw new Error('--email requires a value');
        email = next;
        i++;
        break;
      case '--entity-name':
        if (!next) throw new Error('--entity-name requires a value');
        entityName = next;
        i++;
        break;
      case '--shop-computer-id':
        if (!next) throw new Error('--shop-computer-id requires a value');
        shopComputerId = Number(next);
        if (!Number.isInteger(shopComputerId) || shopComputerId < 0) {
          throw new Error('--shop-computer-id must be a non-negative integer');
        }
        i++;
        break;
      case '--help':
      case '-h':
        console.log(`
Provision Transfer Key + EnderStorage Entity

Usage:
  pnpm run provision-transfer-key -- --name "Shop Transfer" --type shop --shop-computer-id 123 --colors 1,2,4
  pnpm run provision-transfer-key -- --name "Service Transfer" --type service --entity-name service:autostocker --colors 8,16,32

Required:
  --name <string>              API key display name
  --type <shop|service>        Entity type to provision
  --colors <a,b,c>             EnderStorage color triplet using valid values

Optional:
  --tier <tier>                API key tier (default: premium)
  --limit <number>             Custom requests/hour limit
  --email <string>             Email stored with the key
  --entity-name <string>       Explicit entity name (default is derived from type)
  --shop-computer-id <number>  Required for --type shop; linked as shop_computer_id

Notes:
  - This command links the new API key directly to the provisioned ender storage entity.
  - Transfer endpoints currently require free/premium tier keys.
`);
        process.exit(0);
        break;
    }
  }

  if (!keyName) {
    throw new Error('--name is required');
  }

  if (!targetType) {
    throw new Error('--type is required (shop|service)');
  }

  if (!colorsRaw) {
    throw new Error('--colors is required');
  }

  if (targetType === 'shop' && shopComputerId === undefined) {
    throw new Error('--shop-computer-id is required when --type shop');
  }

  const colors = parseColors(colorsRaw);

  return {
    keyName,
    targetType,
    colors,
    tier,
    rateLimit,
    email,
    entityName,
    shopComputerId,
  };
}

async function ensureEntity(
  options: ProvisionOptions,
  transaction: Transaction,
): Promise<EstorageEntity> {
  const [colorA, colorB, colorC] = options.colors;

  const derivedName =
    options.entityName ??
    (options.targetType === 'shop'
      ? `shop:${options.shopComputerId}`
      : `service:${options.keyName.toLowerCase().replace(/\s+/g, '-')}`);

  const existing = await EstorageEntity.findOne({ where: { name: derivedName }, transaction });

  if (existing) {
    existing.entityType = options.targetType;
    existing.colorA = colorA;
    existing.colorB = colorB;
    existing.colorC = colorC;
    existing.active = true;
    await existing.save({ transaction });

    return existing;
  }

  return EstorageEntity.create(
    {
      name: derivedName,
      entityType: options.targetType,
      colorA,
      colorB,
      colorC,
      active: true,
    },
    { transaction },
  );
}

async function ensureShopLink(
  entity: EstorageEntity,
  shopComputerId: number,
  transaction: Transaction,
): Promise<void> {
  const linkValue = String(shopComputerId);

  const existing = await EstorageEntityLink.findOne({
    where: {
      linkType: 'shop_computer_id',
      linkValue,
    },
    transaction,
  });

  if (existing && existing.entityId !== entity.id) {
    throw new Error(
      `shop_computer_id ${shopComputerId} is already linked to another entity (${existing.entityId})`,
    );
  }

  if (!existing) {
    await EstorageEntityLink.create(
      {
        entityId: entity.id,
        linkType: 'shop_computer_id',
        linkValue,
        linkName: `Shop Computer ${shopComputerId}`,
        isPrimary: true,
      },
      { transaction },
    );
  }
}

async function provision(options: ProvisionOptions): Promise<void> {
  await sequelize.authenticate();

  const tx = await sequelize.transaction();

  try {
    const entity = await ensureEntity(options, tx);

    if (options.targetType === 'shop') {
      await ensureShopLink(entity, options.shopComputerId!, tx);
    }

    const rawKey = ApiKey.generateKey();
    const hashedKey = ApiKey.hashKey(rawKey);

    const apiKey = await ApiKey.create(
      {
        key: hashedKey,
        name: options.keyName,
        email: options.email ?? null,
        tier: options.tier,
        rateLimit: options.rateLimit ?? defaultRateLimitForTier(options.tier),
        isActive: true,
        estorageEntityId: entity.id,
      },
      { transaction: tx },
    );

    await tx.commit();

    console.log('Provisioning complete.');
    console.log('');
    console.log(`API Key (save now, shown once): ${rawKey}`);
    console.log(`API Key ID: ${apiKey.id}`);
    console.log(`Tier: ${apiKey.tier}`);
    console.log(`Rate Limit: ${apiKey.rateLimit}/hour`);
    console.log('');
    console.log(`Entity ID: ${entity.id}`);
    console.log(`Entity Name: ${entity.name}`);
    console.log(`Entity Type: ${entity.entityType}`);
    console.log(`Colors: ${entity.colorA},${entity.colorB},${entity.colorC}`);
    if (options.targetType === 'shop') {
      console.log(`Shop Computer ID Link: ${options.shopComputerId}`);
    }
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    await sequelize.close();
  }
}

async function main(): Promise<void> {
  try {
    const options = parseArgs();
    await provision(options);
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('Unknown error while provisioning');
    }

    try {
      await sequelize.close();
    } catch {
      // ignore close errors in failure path
    }

    process.exit(1);
  }
}

void main();
