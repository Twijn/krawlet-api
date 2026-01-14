/**
 * ShopSync Reporter - Lightweight in-memory tracking of ShopSync POST requests
 * Tracks validation failures, successful POSTs, shop changes, and item changes
 *
 * Persistent storage is used for:
 * - Shop changes (name, description, location, software, etc.)
 * - Price/item property changes
 * - Item additions/removals
 */

import { ShopSyncData, ShopSyncListing, ShopSyncPrice } from '../../lib/shopSyncValidate';
import {
  getShop,
  getShopId,
  hashListing,
  ShopChangeLog,
  ItemChangeLog,
  PriceChangeLog,
  getShopChangeLogs,
  getItemChangeLogs,
  getPriceChangeLogs,
  getChangeLogStats,
  ChangeLogQueryOptions,
  ItemChangeType,
  Listing,
} from '../../lib/models';

// ============================================================================
// Types
// ============================================================================

export interface ValidationFailureRecord {
  id: string;
  timestamp: string;
  rawData: unknown;
  errors: string[];
  shopName?: string;
  computerId?: number;
}

export interface SuccessfulPostRecord {
  id: string;
  timestamp: string;
  shopId: string;
  shopName: string;
  rawData: ShopSyncData;
  itemCount: number;
}

export interface ShopChangeField {
  field: string;
  previousValue: unknown;
  newValue: unknown;
}

export interface ShopChangeRecord {
  id: string;
  timestamp: string;
  shopId: string;
  shopName: string;
  changes: ShopChangeField[];
  isNewShop: boolean;
}

export interface ItemChangeRecord {
  id: string;
  timestamp: string;
  shopId: string;
  shopName: string;
  added: ItemSummary[];
  removed: ItemSummary[];
  updated: ItemUpdateSummary[];
}

export interface ItemSummary {
  name: string;
  displayName: string;
  hash: string;
}

export interface ItemUpdateSummary extends ItemSummary {
  changes: ShopChangeField[];
}

export interface ReporterStats {
  // In-memory stats
  validationFailures: number;
  successfulPosts: number;
  shopChanges: number;
  itemChanges: number;
  oldestRecord: string | null;
  newestRecord: string | null;
  // Persistent stats
  persistent: {
    shopChanges: number;
    itemChanges: number;
    priceChanges: number;
    total: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const MAX_RECORDS = 500; // Max records per category to keep in memory

// ============================================================================
// Storage (in-memory, lightweight)
// ============================================================================

const validationFailures: ValidationFailureRecord[] = [];
const successfulPosts: SuccessfulPostRecord[] = [];
const shopChanges: ShopChangeRecord[] = [];
const itemChanges: ItemChangeRecord[] = [];

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function trimArray<T>(arr: T[]): void {
  while (arr.length > MAX_RECORDS) {
    arr.shift();
  }
}

/**
 * Format a price object for human-readable display
 */
function formatPrice(price: { value: number; currency: string; address?: string | null }): string {
  const valueStr = Number(price.value)
    .toFixed(3)
    .replace(/\.?0+$/, '');
  let result = `${valueStr} ${price.currency}`;
  if (price.address) {
    result += ` (${price.address})`;
  }
  return result;
}

/**
 * Convert a value to a human-readable string for storage in change logs
 */
function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;

  // Format boolean values as Yes/No for consistency
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Format price arrays in human-readable format
  if (Array.isArray(value)) {
    // Check if this looks like a prices array
    if (
      value.length > 0 &&
      typeof value[0] === 'object' &&
      value[0] !== null &&
      'value' in value[0] &&
      'currency' in value[0]
    ) {
      return value
        .map((p) => formatPrice(p as { value: number; currency: string; address?: string | null }))
        .join(', ');
    }
    // For other arrays, use JSON
    return JSON.stringify(value);
  }

  // For other objects, use JSON
  return JSON.stringify(value);
}

/**
 * Generate an identity key for matching items across updates.
 * Matches on name+nbt if available, otherwise falls back to displayName.
 */
function getItemIdentityKey(item: {
  name: string;
  nbt?: string | null;
  displayName: string;
}): string {
  // If name exists and is not empty, use name + nbt as identity
  if (item.name && item.name.trim() !== '') {
    return `name:${item.name}|nbt:${item.nbt || ''}`;
  }
  // Otherwise fall back to displayName
  return `displayName:${item.displayName}`;
}

/**
 * Get identity key from a ShopSyncListing
 */
function getNewItemIdentityKey(item: ShopSyncListing): string {
  return getItemIdentityKey({
    name: item.item.name,
    nbt: item.item.nbt,
    displayName: item.item.displayName,
  });
}

/**
 * Get identity key from an existing Listing
 */
function getExistingItemIdentityKey(item: Listing): string {
  return getItemIdentityKey({
    name: item.itemName,
    nbt: item.itemNbt,
    displayName: item.itemDisplayName ?? item.itemName,
  });
}

/**
 * Compare prices between old and new listings
 * Normalizes values to numbers for proper comparison (DB may store as strings)
 */
function comparePrices(
  existingPrices:
    | Array<{ value: number | string; currency: string; address?: string | null }>
    | undefined,
  newPrices: ShopSyncPrice[],
): ShopChangeField[] {
  const changes: ShopChangeField[] = [];

  // Normalize prices: convert value to number (rounded to 3 decimals), normalize currency and address
  const normalizePrice = (p: {
    value: number | string;
    currency: string;
    address?: string | null;
  }) => ({
    // Round to 3 decimal places to avoid floating point comparison issues
    value: Math.round(Number(p.value) * 1000) / 1000,
    currency: (p.currency || '').trim().toUpperCase(),
    address: (p.address || null)?.trim() || null,
  });

  const oldPricesSorted = (existingPrices || [])
    .map(normalizePrice)
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const newPricesSorted = (newPrices || [])
    .map(normalizePrice)
    .sort((a, b) => a.currency.localeCompare(b.currency));

  // Compare normalized values
  const pricesEqual =
    oldPricesSorted.length === newPricesSorted.length &&
    oldPricesSorted.every((old, i) => {
      const newP = newPricesSorted[i];
      return (
        old.value === newP.value && old.currency === newP.currency && old.address === newP.address
      );
    });

  if (!pricesEqual) {
    changes.push({
      field: 'prices',
      previousValue: oldPricesSorted,
      newValue: newPricesSorted,
    });
  }

  return changes;
}

// ============================================================================
// Recording Functions
// ============================================================================

/**
 * Record a validation failure
 */
export function recordValidationFailure(
  rawData: unknown,
  errors: string[],
): ValidationFailureRecord {
  const record: ValidationFailureRecord = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    rawData,
    errors,
    shopName: (rawData as any)?.info?.name,
    computerId: (rawData as any)?.info?.computerID,
  };

  validationFailures.push(record);
  trimArray(validationFailures);

  return record;
}

/**
 * Record a successful POST
 */
export function recordSuccessfulPost(data: ShopSyncData): SuccessfulPostRecord {
  const record: SuccessfulPostRecord = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    shopId: getShopId(data),
    shopName: data.info.name,
    rawData: data,
    itemCount: data.items.length,
  };

  successfulPosts.push(record);
  trimArray(successfulPosts);

  return record;
}

/**
 * Detect and record shop field changes
 */
export async function detectAndRecordShopChanges(
  data: ShopSyncData,
): Promise<ShopChangeRecord | null> {
  const shopId = getShopId(data);
  const existingShop = await getShop(shopId);

  const changes: ShopChangeField[] = [];
  const isNewShop = !existingShop;

  if (existingShop) {
    // Compare fields
    const fieldsToCompare: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }> = [
      { field: 'name', oldValue: existingShop.name, newValue: data.info.name },
      {
        field: 'description',
        oldValue: existingShop.description,
        newValue: data.info.description || null,
      },
      { field: 'owner', oldValue: existingShop.owner, newValue: data.info.owner || null },
      {
        field: 'softwareName',
        oldValue: existingShop.softwareName,
        newValue: data.info.software?.name || null,
      },
      {
        field: 'softwareVersion',
        oldValue: existingShop.softwareVersion,
        newValue: data.info.software?.version || null,
      },
      {
        field: 'locationDescription',
        oldValue: existingShop.locationDescription,
        newValue: data.info.location?.description || null,
      },
      {
        field: 'locationDimension',
        oldValue: existingShop.locationDimension,
        newValue: data.info.location?.dimension || null,
      },
    ];

    // Handle coordinates specially
    let newCoordinates: string | null = null;
    if (
      Array.isArray(data.info.location?.coordinates) &&
      data.info.location.coordinates.length === 3
    ) {
      newCoordinates = data.info.location.coordinates.join(' ');
    }
    fieldsToCompare.push({
      field: 'locationCoordinates',
      oldValue: existingShop.locationCoordinates,
      newValue: newCoordinates,
    });

    for (const { field, oldValue, newValue } of fieldsToCompare) {
      if (oldValue !== newValue) {
        changes.push({
          field,
          previousValue: oldValue,
          newValue: newValue,
        });
      }
    }
  }

  // Only record if there are changes or it's a new shop
  if (changes.length > 0 || isNewShop) {
    const record: ShopChangeRecord = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      shopId,
      shopName: data.info.name,
      changes,
      isNewShop,
    };

    // In-memory storage
    shopChanges.push(record);
    trimArray(shopChanges);

    // Persistent storage - save each field change as a separate row
    try {
      if (isNewShop) {
        // Record new shop creation
        await ShopChangeLog.create({
          shopId,
          shopName: data.info.name,
          field: '_new_shop',
          previousValue: null,
          newValue: 'Shop created',
          isNewShop: true,
        });
      }

      for (const change of changes) {
        await ShopChangeLog.create({
          shopId,
          shopName: data.info.name,
          field: change.field,
          previousValue: stringifyValue(change.previousValue),
          newValue: stringifyValue(change.newValue),
          isNewShop: false,
        });
      }
    } catch (err) {
      console.error('Failed to persist shop change log:', err);
    }

    return record;
  }

  return null;
}

/**
 * Detect and record item changes (added, removed, updated)
 * Uses identity-based matching: matches on name+nbt, or displayName if name/nbt missing
 */
export async function detectAndRecordItemChanges(
  data: ShopSyncData,
): Promise<ItemChangeRecord | null> {
  const shopId = getShopId(data);
  const existingShop = await getShop(shopId);

  const added: ItemSummary[] = [];
  const removed: ItemSummary[] = [];
  const updated: ItemUpdateSummary[] = [];

  // Create maps for comparison using identity keys (not hash)
  const newItemsMap = new Map<string, { item: ShopSyncListing; hash: string }>();
  for (const item of data.items) {
    const identityKey = getNewItemIdentityKey(item);
    const hash = hashListing(shopId, item);
    newItemsMap.set(identityKey, { item, hash });
  }

  if (existingShop?.items) {
    const existingItemsMap = new Map<string, Listing>();
    for (const item of existingShop.items) {
      const identityKey = getExistingItemIdentityKey(item);
      existingItemsMap.set(identityKey, item);
    }

    // Find added and updated items
    for (const [identityKey, { item, hash }] of newItemsMap) {
      const existing = existingItemsMap.get(identityKey);

      if (!existing) {
        // New item
        added.push({
          name: item.item.name,
          displayName: item.item.displayName,
          hash,
        });
      } else {
        // Existing item - check for updates
        const changes: ShopChangeField[] = [];

        // Helper to normalize boolean values (null/undefined -> false)
        const normalizeBool = (val: boolean | null | undefined): boolean => val === true;

        // Stock changes
        if (existing.stock !== (item.stock ?? 0)) {
          changes.push({
            field: 'stock',
            previousValue: existing.stock,
            newValue: item.stock ?? 0,
          });
        }

        // Dynamic price changes
        if (normalizeBool(existing.dynamicPrice) !== normalizeBool(item.dynamicPrice)) {
          changes.push({
            field: 'dynamicPrice',
            previousValue: existing.dynamicPrice ?? false,
            newValue: item.dynamicPrice ?? false,
          });
        }

        // Made on demand changes
        if (normalizeBool(existing.madeOnDemand) !== normalizeBool(item.madeOnDemand)) {
          changes.push({
            field: 'madeOnDemand',
            previousValue: existing.madeOnDemand ?? false,
            newValue: item.madeOnDemand ?? false,
          });
        }

        // No limit changes
        if (normalizeBool(existing.noLimit) !== normalizeBool(item.noLimit)) {
          changes.push({
            field: 'noLimit',
            previousValue: existing.noLimit ?? false,
            newValue: item.noLimit ?? false,
          });
        }

        // Shop buys item changes
        if (normalizeBool(existing.shopBuysItem) !== normalizeBool(item.shopBuysItem)) {
          changes.push({
            field: 'shopBuysItem',
            previousValue: existing.shopBuysItem ?? false,
            newValue: item.shopBuysItem ?? false,
          });
        }

        // Requires interaction changes
        if (
          normalizeBool(existing.requiresInteraction) !== normalizeBool(item.requiresInteraction)
        ) {
          changes.push({
            field: 'requiresInteraction',
            previousValue: existing.requiresInteraction ?? false,
            newValue: item.requiresInteraction ?? false,
          });
        }

        // Display name changes (if using name+nbt for identity)
        if (existing.itemDisplayName !== item.item.displayName) {
          changes.push({
            field: 'displayName',
            previousValue: existing.itemDisplayName,
            newValue: item.item.displayName,
          });
        }

        // Description changes
        if ((existing.itemDescription || null) !== (item.item.description || null)) {
          changes.push({
            field: 'description',
            previousValue: existing.itemDescription,
            newValue: item.item.description || null,
          });
        }

        // Price changes
        const priceChanges = comparePrices(existing.prices, item.prices);
        changes.push(...priceChanges);

        if (changes.length > 0) {
          updated.push({
            name: item.item.name,
            displayName: item.item.displayName,
            hash,
            changes,
          });
        }
      }
    }

    // Find removed items
    for (const [identityKey, item] of existingItemsMap) {
      if (!newItemsMap.has(identityKey)) {
        removed.push({
          name: item.itemName,
          displayName: item.itemDisplayName ?? item.itemName,
          hash: item.hash,
        });
      }
    }
  } else {
    // No existing shop, all items are new
    for (const [, { item, hash }] of newItemsMap) {
      added.push({
        name: item.item.name,
        displayName: item.item.displayName,
        hash,
      });
    }
  }

  // Only record if there are changes
  if (added.length > 0 || removed.length > 0 || updated.length > 0) {
    const record: ItemChangeRecord = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      shopId,
      shopName: data.info.name,
      added,
      removed,
      updated,
    };

    // In-memory storage
    itemChanges.push(record);
    trimArray(itemChanges);

    // Persistent storage
    try {
      // Log added items
      for (const item of added) {
        await ItemChangeLog.create({
          shopId,
          shopName: data.info.name,
          changeType: 'added',
          itemName: item.name,
          itemDisplayName: item.displayName,
          itemHash: item.hash,
        });
      }

      // Log removed items
      for (const item of removed) {
        await ItemChangeLog.create({
          shopId,
          shopName: data.info.name,
          changeType: 'removed',
          itemName: item.name,
          itemDisplayName: item.displayName,
          itemHash: item.hash,
        });
      }

      // Log price/property changes
      for (const item of updated) {
        for (const change of item.changes) {
          // Only log actual price changes to price_change_logs
          // Stock and other property changes should not be in price change logs
          if (change.field === 'prices') {
            await PriceChangeLog.create({
              shopId,
              shopName: data.info.name,
              itemName: item.name,
              itemDisplayName: item.displayName,
              itemHash: item.hash,
              field: change.field,
              previousValue: stringifyValue(change.previousValue),
              newValue: stringifyValue(change.newValue),
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to persist item change logs:', err);
    }

    return record;
  }

  return null;
}

// ============================================================================
// Retrieval Functions
// ============================================================================

export function getValidationFailures(limit?: number): ValidationFailureRecord[] {
  const records = [...validationFailures].reverse();
  return limit ? records.slice(0, limit) : records;
}

export function getSuccessfulPosts(limit?: number): SuccessfulPostRecord[] {
  const records = [...successfulPosts].reverse();
  return limit ? records.slice(0, limit) : records;
}

export function getShopChanges(limit?: number, shopId?: string): ShopChangeRecord[] {
  let records = [...shopChanges].reverse();
  if (shopId) {
    records = records.filter((r) => r.shopId === shopId);
  }
  return limit ? records.slice(0, limit) : records;
}

export function getItemChanges(limit?: number, shopId?: string): ItemChangeRecord[] {
  let records = [...itemChanges].reverse();
  if (shopId) {
    records = records.filter((r) => r.shopId === shopId);
  }
  return limit ? records.slice(0, limit) : records;
}

export function getRecordById(
  id: string,
): ValidationFailureRecord | SuccessfulPostRecord | ShopChangeRecord | ItemChangeRecord | null {
  return (
    validationFailures.find((r) => r.id === id) ||
    successfulPosts.find((r) => r.id === id) ||
    shopChanges.find((r) => r.id === id) ||
    itemChanges.find((r) => r.id === id) ||
    null
  );
}

// ============================================================================
// Persistent Retrieval Functions (re-export with consistent naming)
// ============================================================================

export { getShopChangeLogs, getItemChangeLogs, getPriceChangeLogs, getChangeLogStats };

export type { ChangeLogQueryOptions, ItemChangeType };

// ============================================================================
// Combined Stats
// ============================================================================

export async function getReporterStats(): Promise<ReporterStats> {
  const allTimestamps = [
    ...validationFailures.map((r) => r.timestamp),
    ...successfulPosts.map((r) => r.timestamp),
    ...shopChanges.map((r) => r.timestamp),
    ...itemChanges.map((r) => r.timestamp),
  ].sort();

  let persistentStats = { shopChanges: 0, itemChanges: 0, priceChanges: 0, total: 0 };
  try {
    persistentStats = await getChangeLogStats();
  } catch (err) {
    console.error('Failed to get persistent stats:', err);
  }

  return {
    validationFailures: validationFailures.length,
    successfulPosts: successfulPosts.length,
    shopChanges: shopChanges.length,
    itemChanges: itemChanges.length,
    oldestRecord: allTimestamps[0] || null,
    newestRecord: allTimestamps[allTimestamps.length - 1] || null,
    persistent: persistentStats,
  };
}

/**
 * Clear all in-memory records (useful for testing or maintenance)
 * Note: Does NOT clear persistent database records
 */
export function clearAllRecords(): void {
  validationFailures.length = 0;
  successfulPosts.length = 0;
  shopChanges.length = 0;
  itemChanges.length = 0;
}
