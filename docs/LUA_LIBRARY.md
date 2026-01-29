# Krawlet Lua Library

A comprehensive Lua client library for the Krawlet API, designed for CC: Tweaked (Minecraft 1.20.1+).

## Installation

Run this command on any CC: Tweaked computer:

```
wget https://krawlet.cc/krawlet.lua /krawlet.lua
```

## Quick Start

```lua
local krawlet = require("krawlet")

-- Check API health
local healthy, status = krawlet.healthCheck()
print("API Status:", status)

-- Get all shops
local shops = krawlet.getShops()
for _, shop in ipairs(shops or {}) do
    print(shop.name)
end

-- Find a player by name
local player = krawlet.getPlayerByName("Twijn")
if player then
    print("Address:", player.kromerAddress)
end
```

## Features

- **Full API Coverage**: Access all Krawlet API endpoints
- **Type Annotations**: Full LuaLS/EmmyLua annotations for IDE support
- **Price Comparison**: Built-in utilities to find best prices
- **Authentication**: Support for API keys and quick codes
- **Rate Limit Tracking**: Automatic rate limit header parsing
- **Debug Mode**: Easy debugging with verbose logging

## Configuration

### Setting the Endpoint

```lua
-- Default is production: https://api.krawlet.cc/api
krawlet.setEndpoint("https://api.krawlet.cc/api")

-- For local development:
krawlet.setEndpoint("http://localhost:3330/api")
```

### Authentication

```lua
-- Set API key directly
krawlet.setApiKey("kraw_your_api_key_here")

-- Or redeem a quick code (from \krawlet api chat command)
local result = krawlet.redeemQuickCode("123456")
if result then
    print("API Key:", result.apiKey)
end

-- Clear API key
krawlet.clearApiKey()

-- Check if authenticated
if krawlet.hasApiKey() then
    print("Authenticated!")
end
```

### Debug Mode

```lua
-- Enable debug logging
krawlet.setDebug(true)

-- Dump internal state
krawlet._dumpState()
```

## API Reference

### Health Check

```lua
local healthy, status = krawlet.healthCheck()
-- Returns: boolean, string
```

### Players

```lua
-- Get all players
local players, err = krawlet.getPlayers()

-- Get player by name
local player, err = krawlet.getPlayerByName("Twijn")

-- Get player by UUID
local player, err = krawlet.getPlayerByUUID("d98440d6-5117-4ac8-bd50-70b086101e3e")

-- Get player by Kromer address
local player, err = krawlet.getPlayerByAddress("ks0d5iqb6p")

-- Get multiple players
local players, err = krawlet.getPlayersByNames({"Twijn", "Player2"})
local players, err = krawlet.getPlayersByUUIDs({"uuid1", "uuid2"})
local players, err = krawlet.getPlayersByAddresses({"addr1", "addr2"})
```

**Player Object:**

```lua
{
    minecraftUUID = "d98440d6-5117-4ac8-bd50-70b086101e3e",
    minecraftName = "Twijn",
    kromerAddress = "ks0d5iqb6p",
    notifications = "none",  -- "none", "self", or "all"
    online = true,
    createdDate = "2026-01-12T10:00:00.000Z",
    updatedDate = "2026-01-12T10:00:00.000Z"
}
```

### Shops

```lua
-- Get all shops
local shops, err = krawlet.getShops()

-- Get shop by ID
local shop, err = krawlet.getShop(123)

-- Get shop items
local items, err = krawlet.getShopItems(123)

-- Search shops by name
local shops, err = krawlet.searchShops("diamond")
```

**Shop Object:**

```lua
{
    id = "123",
    name = "Diamond Emporium",
    description = "Best diamonds in town",
    owner = "Twijn",
    computerId = 123,
    softwareName = "ShopSync",
    softwareVersion = "1.0.0",
    locationCoordinates = "100, 64, -200",
    locationDescription = "Spawn area",
    locationDimension = "overworld",
    items = { ... },
    addresses = { "ks0d5iqb6p" },
    createdDate = "...",
    updatedDate = "..."
}
```

### Items

```lua
-- Get all items
local items, err = krawlet.getItems()

-- Search items by name
local items, err = krawlet.searchItems("diamond")

-- Find best buy prices (lowest)
local deals, err = krawlet.findBestPrices("diamond", "KST", 10)

-- Find best sell prices (highest)
local deals, err = krawlet.findBestSellPrices("iron_ingot", "KST", 10)
```

**Item Object:**

```lua
{
    id = "item-123",
    shopId = "shop-456",
    itemName = "minecraft:diamond",
    itemDisplayName = "Diamond",
    itemDescription = "Shiny!",
    shopBuysItem = false,
    noLimit = false,
    dynamicPrice = false,
    madeOnDemand = false,
    requiresInteraction = false,
    stock = 64,
    prices = {
        { id = "...", value = 10.5, currency = "KST", address = "..." }
    },
    addresses = { "..." }
}
```

**Price Deal Object (from findBestPrices):**

```lua
{
    item = { ... },      -- Full item object
    price = 10.5,        -- Price value
    currency = "KST",    -- Currency type
    shop = { ... },      -- Full shop object
    stock = 64           -- Available stock
}
```

### Known Addresses

```lua
-- Get all known addresses
local addresses, err = krawlet.getKnownAddresses()

-- Look up a specific address
local info, err = krawlet.lookupAddress("ks0d5iqb6p")

-- Get addresses by type
local shops, err = krawlet.getAddressesByType("shop")
-- Types: "official", "shop", "gamble", "service", "company"
```

### Ender Storage

```lua
local data, err = krawlet.getEnderStorage()
```

### Reports

```lua
-- Get report statistics
local stats, err = krawlet.getReportStats()

-- Get change logs (with optional filters)
local logs, err = krawlet.getShopChangeLogs({ limit = 50, shopId = "123" })
local logs, err = krawlet.getItemChangeLogs({ limit = 50, since = "2026-01-01" })
local logs, err = krawlet.getPriceChangeLogs({ offset = 0, until = "2026-01-31" })
```

### API Key Management

```lua
-- Redeem a quick code (no auth required)
local result, err = krawlet.redeemQuickCode("123456")
-- result = { apiKey = "kraw_...", tier = "free", rateLimit = 1000, ... }

-- Get API key info (requires auth)
local info, err = krawlet.getApiKeyInfo()
local info, err = krawlet.getApiKeyInfo(false)  -- Skip usage stats

-- Get usage statistics
local usage, err = krawlet.getApiKeyUsage()

-- Get request logs
local logs, err = krawlet.getApiKeyLogs(50)

-- Generate a quick code for your key
local code, err = krawlet.generateQuickCode()
```

### Utilities

```lua
-- Format currency
print(krawlet.formatKromer(1234.5))  -- "1,234.50 KST"

-- Parse item name
local parsed = krawlet.parseItemName("minecraft:diamond")
-- { mod = "minecraft", item = "diamond", full = "minecraft:diamond" }

-- Pretty print tables
krawlet.prettyPrint(someTable)

-- Get rate limit info from last request
local rl = krawlet.getRateLimit()
if rl then
    print(string.format("%d/%d requests remaining", rl.remaining, rl.limit))
end

-- Install/update the library
local success, msg = krawlet.install("/krawlet.lua")

-- Check for updates
local hasUpdate, newVersion = krawlet.checkForUpdate()
```

## Examples

### Shop Finder Program

```lua
-- shop_finder.lua
local krawlet = require("krawlet")

-- Load saved API key
if fs.exists("/.krawlet_key") then
    local f = fs.open("/.krawlet_key", "r")
    krawlet.setApiKey(f.readAll())
    f.close()
end

print("=== Krawlet Shop Finder ===")
print()

while true do
    write("Search for item: ")
    local query = read()

    if query == "quit" then break end

    local deals = krawlet.findBestPrices(query, "KST", 5)

    if not deals or #deals == 0 then
        print("No results found")
    else
        print("\nTop 5 deals:")
        for i, deal in ipairs(deals) do
            print(string.format("%d. %s at %s",
                i,
                deal.shop.name,
                krawlet.formatKromer(deal.price)))
        end
    end
    print()
end
```

### Price Alert Monitor

```lua
-- price_alert.lua
local krawlet = require("krawlet")

local ITEM = "minecraft:diamond"
local MAX_PRICE = 15  -- Alert if price drops below this
local CHECK_INTERVAL = 300  -- 5 minutes

print("Monitoring " .. ITEM .. " prices...")
print("Alert threshold: " .. krawlet.formatKromer(MAX_PRICE))

while true do
    local deals = krawlet.findBestPrices(ITEM, "KST", 1)

    if deals and #deals > 0 then
        local best = deals[1]

        if best.price <= MAX_PRICE then
            -- Alert!
            print("\n!!! DEAL ALERT !!!")
            print(best.item.itemDisplayName or best.item.itemName)
            print("Price: " .. krawlet.formatKromer(best.price))
            print("Shop: " .. (best.shop and best.shop.name or "Unknown"))
            print("Stock: " .. (best.stock or 0))

            -- Play sound if speaker is attached
            local speaker = peripheral.find("speaker")
            if speaker then
                speaker.playNote("bell", 1, 12)
            end
        end
    end

    sleep(CHECK_INTERVAL)
end
```

## Error Handling

All API functions return two values: the result and an error message.

```lua
local player, err = krawlet.getPlayerByName("NonExistentPlayer")

if player then
    print("Found: " .. player.minecraftName)
else
    print("Error: " .. (err or "Unknown error"))
end
```

## Rate Limiting

The API has rate limits based on authentication:

- **Anonymous**: 100 requests/hour
- **Free tier**: 1,000 requests/hour
- **Premium tier**: 5,000 requests/hour

You can check your current rate limit status:

```lua
local rl = krawlet.getRateLimit()
if rl then
    print(string.format("Requests: %d/%d", rl.limit - rl.remaining, rl.limit))
    print(string.format("Resets at: %d", rl.reset))
end
```

## Version

```lua
print("Krawlet Library v" .. krawlet.VERSION)
```

## License

MIT License - See repository for details.

## Links

- **API Documentation**: https://krawlet.cc/docs/v1
- **Lua Documentation**: https://krawlet.cc/docs/lua
- **GitHub**: https://github.com/Twijn/krawlet-api
