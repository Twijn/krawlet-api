# ShopSync Reports API Reference

The ShopSync Reports API provides endpoints for retrieving reporting data about ShopSync activity, including validation failures, successful posts, shop changes, and item/price changes.

**Base URL:** `/shopsync/reports`

---

## Overview

The Reports API tracks two types of data:

1. **In-Memory (Recent)** - Lightweight, fast access to the most recent ~500 records per category
2. **Persistent (History)** - Database-backed storage for long-term historical data

Most endpoints return both sources by default and support a `source` parameter to filter.

---

## TypeScript Type Definitions

### ShopSync Input Types

These types represent the data structure sent to the ShopSync API via POST requests.

```typescript
interface ShopSyncData {
  type: string; // Must be "ShopSync"
  version?: number; // Protocol version
  info: ShopSyncInfo;
  items: ShopSyncListing[];
}

interface ShopSyncInfo {
  name: string; // Shop name (required)
  description?: string; // Shop description
  owner?: string; // Shop owner username
  computerID: number; // Computer ID (required)
  multiShop?: number | null; // Multi-shop identifier
  software?: ShopSyncSoftware;
  location?: ShopSyncLocation;
  otherLocations?: ShopSyncLocation[];
}

interface ShopSyncSoftware {
  name?: string; // Software name (e.g., "ShopSync")
  version?: string; // Software version
}

interface ShopSyncLocation {
  coordinates?: number[]; // [x, y, z] coordinates
  description?: string; // Location description
  dimension?: 'overworld' | 'nether' | 'end';
}

interface ShopSyncListing {
  prices: ShopSyncPrice[];
  item: ShopSyncItem;
  dynamicPrice?: boolean; // Price changes dynamically
  stock?: number | null; // Current stock level
  madeOnDemand?: boolean; // Item is crafted on demand
  requiresInteraction?: boolean; // Purchase requires interaction
  shopBuysItem?: boolean; // Shop buys this item from players
  noLimit?: boolean; // No purchase limit
}

interface ShopSyncPrice {
  value: number; // Price value
  currency: string; // Currency identifier (e.g., "KST")
  address?: string; // Payment address
  requiredMeta?: string; // Required metadata for payment
}

interface ShopSyncItem {
  name: string; // Minecraft item ID (e.g., "minecraft:diamond")
  nbt?: string | null; // NBT data string
  displayName: string; // Display name shown to players
  description?: string | null; // Item description
}
```

### Reporter Record Types

These types represent the records returned by the Reports API.

```typescript
interface ValidationFailureRecord {
  id: string; // Unique record identifier
  timestamp: string; // ISO timestamp
  rawData: unknown; // Original POST data that failed
  errors: string[]; // List of validation error messages
  shopName?: string; // Shop name if parseable
  computerId?: number; // Computer ID if parseable
}

interface SuccessfulPostRecord {
  id: string; // Unique record identifier
  timestamp: string; // ISO timestamp
  shopId: string; // Unique shop identifier
  shopName: string; // Shop name
  rawData: ShopSyncData; // Complete posted data
  itemCount: number; // Number of items in POST
}

interface ShopChangeRecord {
  id: string; // Unique record identifier
  timestamp: string; // ISO timestamp
  shopId: string; // Unique shop identifier
  shopName: string; // Shop name
  changes: ShopChangeField[]; // Array of field changes
  isNewShop: boolean; // Whether this is a new shop
}

interface ShopChangeField {
  field: string; // Name of changed field
  previousValue: unknown; // Value before change
  newValue: unknown; // Value after change
}

interface ItemChangeRecord {
  id: string; // Unique record identifier
  timestamp: string; // ISO timestamp
  shopId: string; // Unique shop identifier
  shopName: string; // Shop name
  added: ItemSummary[]; // Items added to shop
  removed: ItemSummary[]; // Items removed from shop
  updated: ItemUpdateSummary[]; // Items with property changes
}

interface ItemSummary {
  name: string; // Minecraft item ID
  displayName: string; // Display name
  hash: string; // Unique listing hash
}

interface ItemUpdateSummary extends ItemSummary {
  changes: ShopChangeField[]; // Array of property changes
}

interface ReporterStats {
  // In-memory stats
  validationFailures: number;
  successfulPosts: number;
  shopChanges: number;
  itemChanges: number;
  oldestRecord: string | null; // ISO timestamp
  newestRecord: string | null; // ISO timestamp
  // Persistent database stats
  persistent: {
    shopChanges: number;
    itemChanges: number;
    priceChanges: number;
    total: number;
  };
}
```

### Persistent Database Record Types

These types represent records stored in the database for long-term history.

```typescript
interface ShopChangeLog {
  id: number; // Database record ID
  shopId: string; // Unique shop identifier
  shopName: string; // Shop name
  field: string; // Changed field name
  previousValue: string | null; // JSON-stringified previous value
  newValue: string | null; // JSON-stringified new value
  isNewShop: boolean; // Whether this was a new shop creation
  createdAt: string; // ISO timestamp
}

interface ItemChangeLog {
  id: number; // Database record ID
  shopId: string; // Unique shop identifier
  shopName: string; // Shop name
  changeType: 'added' | 'removed'; // Type of change
  itemName: string; // Minecraft item ID
  itemDisplayName: string; // Display name
  itemHash: string; // Unique listing hash
  createdAt: string; // ISO timestamp
}

interface PriceChangeLog {
  id: number; // Database record ID
  shopId: string; // Unique shop identifier
  shopName: string; // Shop name
  itemName: string; // Minecraft item ID
  itemDisplayName: string; // Display name
  itemHash: string; // Unique listing hash
  field: string; // Changed property name
  previousValue: string | null; // JSON-stringified previous value
  newValue: string | null; // JSON-stringified new value
  createdAt: string; // ISO timestamp
}

// Query options for persistent log retrieval
interface ChangeLogQueryOptions {
  limit?: number; // Max records to return
  offset?: number; // Pagination offset
  shopId?: string; // Filter by shop ID
  itemHash?: string; // Filter by item hash (price changes only)
  changeType?: 'added' | 'removed'; // Filter by change type (item changes only)
  since?: Date; // Start of date range
  until?: Date; // End of date range
}
```

---

## Endpoints

### GET /reports/stats

Get overall statistics about recorded data from both in-memory and persistent storage.

#### Response

```json
{
  "ok": true,
  "data": {
    "validationFailures": 5,
    "successfulPosts": 150,
    "shopChanges": 23,
    "itemChanges": 87,
    "oldestRecord": "2025-12-27T00:00:00.000Z",
    "newestRecord": "2025-12-27T12:34:56.789Z",
    "persistent": {
      "shopChanges": 1024,
      "itemChanges": 5432,
      "priceChanges": 2341,
      "total": 8797
    }
  }
}
```

| Field                     | Type           | Description                              |
| ------------------------- | -------------- | ---------------------------------------- |
| `validationFailures`      | number         | Count of validation failures in memory   |
| `successfulPosts`         | number         | Count of successful POSTs in memory      |
| `shopChanges`             | number         | Count of shop changes in memory          |
| `itemChanges`             | number         | Count of item changes in memory          |
| `oldestRecord`            | string \| null | ISO timestamp of oldest in-memory record |
| `newestRecord`            | string \| null | ISO timestamp of newest in-memory record |
| `persistent.shopChanges`  | number         | Total shop changes in database           |
| `persistent.itemChanges`  | number         | Total item changes in database           |
| `persistent.priceChanges` | number         | Total price changes in database          |
| `persistent.total`        | number         | Total persistent records                 |

---

### GET /reports/validation-failures

Get validation failure records (in-memory only).

#### Query Parameters

| Parameter | Type   | Required | Description                         |
| --------- | ------ | -------- | ----------------------------------- |
| `limit`   | number | No       | Maximum number of records to return |

#### Response

```json
{
  "ok": true,
  "count": 2,
  "data": [
    {
      "id": "1735312496789-abc123",
      "timestamp": "2025-12-27T12:34:56.789Z",
      "rawData": { ... },
      "errors": ["Missing required field: info.name", "Invalid computerID type"],
      "shopName": "MyShop",
      "computerId": 42
    }
  ]
}
```

| Field        | Type                | Description                                   |
| ------------ | ------------------- | --------------------------------------------- |
| `id`         | string              | Unique record identifier                      |
| `timestamp`  | string              | ISO timestamp when failure was recorded       |
| `rawData`    | unknown             | The original POST data that failed validation |
| `errors`     | string[]            | List of validation error messages             |
| `shopName`   | string \| undefined | Shop name if parseable from raw data          |
| `computerId` | number \| undefined | Computer ID if parseable from raw data        |

---

### GET /reports/successful-posts

Get successful POST records (in-memory only).

#### Query Parameters

| Parameter | Type   | Required | Description                         |
| --------- | ------ | -------- | ----------------------------------- |
| `limit`   | number | No       | Maximum number of records to return |

#### Response

```json
{
  "ok": true,
  "count": 1,
  "data": [
    {
      "id": "1735312496789-xyz456",
      "timestamp": "2025-12-27T12:34:56.789Z",
      "shopId": "MyShop-42",
      "shopName": "MyShop",
      "rawData": { ... },
      "itemCount": 25
    }
  ]
}
```

| Field       | Type   | Description                                |
| ----------- | ------ | ------------------------------------------ |
| `id`        | string | Unique record identifier                   |
| `timestamp` | string | ISO timestamp when POST was processed      |
| `shopId`    | string | Unique shop identifier                     |
| `shopName`  | string | Name of the shop                           |
| `rawData`   | object | The complete ShopSync data that was posted |
| `itemCount` | number | Number of items in the POST                |

---

### GET /reports/shop-changes

Get shop change records (in-memory + persistent history).

#### Query Parameters

| Parameter | Type   | Required | Description                                                 |
| --------- | ------ | -------- | ----------------------------------------------------------- |
| `limit`   | number | No       | Maximum records to return                                   |
| `offset`  | number | No       | Pagination offset (persistent only)                         |
| `shopId`  | string | No       | Filter by specific shop ID                                  |
| `since`   | string | No       | ISO date for start of range (persistent only)               |
| `until`   | string | No       | ISO date for end of range (persistent only)                 |
| `source`  | string | No       | `'memory'`, `'persistent'`, or `'both'` (default: `'both'`) |

#### Response

```json
{
  "ok": true,
  "recent": [
    {
      "id": "1735312496789-shop1",
      "timestamp": "2025-12-27T12:34:56.789Z",
      "shopId": "MyShop-42",
      "shopName": "MyShop",
      "changes": [
        {
          "field": "description",
          "previousValue": "Old description",
          "newValue": "New description"
        }
      ],
      "isNewShop": false
    }
  ],
  "recentCount": 1,
  "history": [
    {
      "id": 1,
      "shopId": "MyShop-42",
      "shopName": "MyShop",
      "field": "name",
      "previousValue": "OldName",
      "newValue": "MyShop",
      "isNewShop": false,
      "createdAt": "2025-12-27T10:00:00.000Z"
    }
  ],
  "historyCount": 1
}
```

#### In-Memory Record Fields

| Field       | Type              | Description                          |
| ----------- | ----------------- | ------------------------------------ |
| `id`        | string            | Unique record identifier             |
| `timestamp` | string            | ISO timestamp of the change          |
| `shopId`    | string            | Unique shop identifier               |
| `shopName`  | string            | Name of the shop                     |
| `changes`   | ShopChangeField[] | Array of field changes               |
| `isNewShop` | boolean           | Whether this is a newly created shop |

#### ShopChangeField

| Field           | Type    | Description               |
| --------------- | ------- | ------------------------- |
| `field`         | string  | Name of the changed field |
| `previousValue` | unknown | Value before the change   |
| `newValue`      | unknown | Value after the change    |

**Tracked Shop Fields:**

- `name` - Shop name
- `description` - Shop description
- `owner` - Shop owner
- `softwareName` - Software name (e.g., "ShopSync")
- `softwareVersion` - Software version
- `locationDescription` - Location description text
- `locationDimension` - Dimension (e.g., "overworld")
- `locationCoordinates` - Coordinates as "x y z" string

---

### GET /reports/item-changes

Get item change records (in-memory + persistent history).

#### Query Parameters

| Parameter    | Type   | Required | Description                                                 |
| ------------ | ------ | -------- | ----------------------------------------------------------- |
| `limit`      | number | No       | Maximum records to return                                   |
| `offset`     | number | No       | Pagination offset (persistent only)                         |
| `shopId`     | string | No       | Filter by specific shop ID                                  |
| `changeType` | string | No       | `'added'` or `'removed'` (persistent only)                  |
| `since`      | string | No       | ISO date for start of range (persistent only)               |
| `until`      | string | No       | ISO date for end of range (persistent only)                 |
| `source`     | string | No       | `'memory'`, `'persistent'`, or `'both'` (default: `'both'`) |

#### Response

```json
{
  "ok": true,
  "recent": [
    {
      "id": "1735312496789-item1",
      "timestamp": "2025-12-27T12:34:56.789Z",
      "shopId": "MyShop-42",
      "shopName": "MyShop",
      "added": [
        {
          "name": "minecraft:diamond",
          "displayName": "Diamond",
          "hash": "abc123def456"
        }
      ],
      "removed": [],
      "updated": [
        {
          "name": "minecraft:iron_ingot",
          "displayName": "Iron Ingot",
          "hash": "xyz789ghi012",
          "changes": [
            {
              "field": "stock",
              "previousValue": 100,
              "newValue": 150
            }
          ]
        }
      ]
    }
  ],
  "recentCount": 1,
  "history": [
    {
      "id": 1,
      "shopId": "MyShop-42",
      "shopName": "MyShop",
      "changeType": "added",
      "itemName": "minecraft:diamond",
      "itemDisplayName": "Diamond",
      "itemHash": "abc123def456",
      "createdAt": "2025-12-27T10:00:00.000Z"
    }
  ],
  "historyCount": 1
}
```

#### In-Memory Record Fields

| Field       | Type                | Description                 |
| ----------- | ------------------- | --------------------------- |
| `id`        | string              | Unique record identifier    |
| `timestamp` | string              | ISO timestamp of the change |
| `shopId`    | string              | Unique shop identifier      |
| `shopName`  | string              | Name of the shop            |
| `added`     | ItemSummary[]       | Items added to the shop     |
| `removed`   | ItemSummary[]       | Items removed from the shop |
| `updated`   | ItemUpdateSummary[] | Items with property changes |

#### ItemSummary

| Field         | Type   | Description                                   |
| ------------- | ------ | --------------------------------------------- |
| `name`        | string | Minecraft item ID (e.g., "minecraft:diamond") |
| `displayName` | string | Display name of the item                      |
| `hash`        | string | Unique hash for this listing                  |

#### ItemUpdateSummary

Extends `ItemSummary` with:

| Field     | Type              | Description               |
| --------- | ----------------- | ------------------------- |
| `changes` | ShopChangeField[] | Array of property changes |

**Tracked Item Properties:**

- `stock` - Current stock level
- `dynamicPrice` - Whether price changes dynamically
- `madeOnDemand` - Whether item is made on demand
- `noLimit` - Whether there's no purchase limit
- `shopBuysItem` - Whether the shop buys this item
- `requiresInteraction` - Whether purchase requires interaction
- `displayName` - Item display name
- `description` - Item description
- `prices` - Price array with value, currency, and address

---

### GET /reports/price-changes

Get price/property change records (persistent database only).

#### Query Parameters

| Parameter  | Type   | Required | Description                  |
| ---------- | ------ | -------- | ---------------------------- |
| `limit`    | number | No       | Maximum records to return    |
| `offset`   | number | No       | Pagination offset            |
| `shopId`   | string | No       | Filter by specific shop ID   |
| `itemHash` | string | No       | Filter by specific item hash |
| `since`    | string | No       | ISO date for start of range  |
| `until`    | string | No       | ISO date for end of range    |

#### Response

```json
{
  "ok": true,
  "count": 2,
  "data": [
    {
      "id": 1,
      "shopId": "MyShop-42",
      "shopName": "MyShop",
      "itemName": "minecraft:diamond",
      "itemDisplayName": "Diamond",
      "itemHash": "abc123def456",
      "field": "prices",
      "previousValue": "[{\"value\":10,\"currency\":\"KST\"}]",
      "newValue": "[{\"value\":12,\"currency\":\"KST\"}]",
      "createdAt": "2025-12-27T12:34:56.789Z"
    }
  ]
}
```

| Field             | Type           | Description                            |
| ----------------- | -------------- | -------------------------------------- |
| `id`              | number         | Database record ID                     |
| `shopId`          | string         | Unique shop identifier                 |
| `shopName`        | string         | Name of the shop                       |
| `itemName`        | string         | Minecraft item ID                      |
| `itemDisplayName` | string         | Display name of the item               |
| `itemHash`        | string         | Unique hash for this listing           |
| `field`           | string         | Name of the changed property           |
| `previousValue`   | string \| null | JSON-stringified previous value        |
| `newValue`        | string \| null | JSON-stringified new value             |
| `createdAt`       | string         | ISO timestamp when change was recorded |

---

### GET /reports/record/:id

Get a specific record by ID from any in-memory category.

#### Path Parameters

| Parameter | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| `id`      | string | Yes      | The unique record ID |

#### Response (Success)

```json
{
  "ok": true,
  "data": {
    "id": "1735312496789-abc123",
    "timestamp": "2025-12-27T12:34:56.789Z",
    ...
  }
}
```

#### Response (Not Found)

```json
{
  "ok": false,
  "error": "Record not found"
}
```

---

### GET /reports/all

Get all records from all in-memory categories (useful for debugging).

#### Query Parameters

| Parameter | Type   | Required | Default | Description                  |
| --------- | ------ | -------- | ------- | ---------------------------- |
| `limit`   | number | No       | 50      | Maximum records per category |

#### Response

```json
{
  "ok": true,
  "data": {
    "stats": { ... },
    "validationFailures": [ ... ],
    "successfulPosts": [ ... ],
    "shopChanges": [ ... ],
    "itemChanges": [ ... ]
  }
}
```

---

## Error Responses

All endpoints return a standard error format on failure:

```json
{
  "ok": false,
  "error": "Error message describing the issue"
}
```

| Status Code | Description           |
| ----------- | --------------------- |
| 404         | Record not found      |
| 500         | Internal server error |

---

## Data Retention

- **In-Memory:** Maximum 500 records per category, oldest records are automatically removed
- **Persistent:** Stored indefinitely in the database

---

## Examples

### Get Recent Shop Changes for a Specific Shop

```bash
curl "http://localhost:3000/shopsync/reports/shop-changes?shopId=MyShop-42&limit=10"
```

### Get Price Changes in the Last 24 Hours

```bash
curl "http://localhost:3000/shopsync/reports/price-changes?since=2025-12-26T00:00:00.000Z"
```

### Get Only In-Memory Item Changes

```bash
curl "http://localhost:3000/shopsync/reports/item-changes?source=memory&limit=20"
```

### Get All Data for Debugging

```bash
curl "http://localhost:3000/shopsync/reports/all?limit=10"
```
