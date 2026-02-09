--- Krawlet API client library for CC: Tweaked (Minecraft 1.20.1+)
--- A comprehensive Lua library for interacting with the Krawlet API.
---
--- Features:
---   - Shop and item queries
---   - Player lookups by name, UUID, or Kromer address
---   - Known address lookups
---   - Ender storage data retrieval
---   - API key management and quick code redemption
---   - Rate limit tracking
---   - Full type annotations for CC: Tweaked LSP
---
--- @usage
--- local krawlet = require("krawlet")
---
--- -- Configure (optional - defaults to production API)
--- krawlet.setEndpoint("https://api.krawlet.cc")
---
--- -- Set API key for authenticated requests (optional)
--- krawlet.setApiKey("kraw_your_api_key_here")
---
--- -- Get all shops
--- local shops = krawlet.getShops()
---
--- -- Find a player by name
--- local player = krawlet.getPlayerByName("Twijn")
---
--- -- Search items
--- local items = krawlet.getItems()
---
--- @version 1.0.0
--- @module krawlet

local VERSION = "1.0.0"

-------------------------------------------------------------------------------
-- Type Definitions
-------------------------------------------------------------------------------

---@class KrawletMeta
---@field timestamp string ISO 8601 timestamp
---@field elapsed number Request processing time in ms
---@field version string API version
---@field requestId string Unique request ID
---@field rateLimit? KrawletRateLimit Rate limit info (when authenticated)

---@class KrawletRateLimit
---@field limit number Maximum requests per hour
---@field remaining number Requests remaining in window
---@field reset number Unix timestamp when limit resets

---@class KrawletResponse
---@field success boolean Whether the request succeeded
---@field data any Response data
---@field meta? KrawletMeta Response metadata
---@field error? KrawletError Error info (when success=false)

---@class KrawletError
---@field code string Error code
---@field message string Human-readable error message
---@field details? table Additional error details

---@class KrawletPlayer
---@field minecraftUUID string Player's Minecraft UUID
---@field minecraftName string Player's Minecraft username
---@field kromerAddress string 10-character Kromer address
---@field notifications string Notification preference (none/self/all)
---@field online boolean Whether the player is currently online
---@field createdDate? string ISO 8601 timestamp
---@field updatedDate? string ISO 8601 timestamp

---@alias KrawletShopSourceType "modem" | "radio_tower"

---@alias KrawletApiKeyTier "free" | "premium" | "shopsync" | "enderstorage" | "internal"

---@class KrawletShop
---@field id string Shop ID
---@field name string Shop name
---@field description? string Shop description
---@field owner? string Shop owner
---@field computerId number Computer ID
---@field softwareName? string Shop software name
---@field softwareVersion? string Shop software version
---@field locationCoordinates? string Location coordinates
---@field locationDescription? string Location description
---@field locationDimension? string Dimension (overworld, nether, end)
---@field sourceType KrawletShopSourceType How the shop was added (modem=direct, radio_tower=CC Radio Tower)
---@field items KrawletItem[] Shop items
---@field addresses string[] Associated Kromer addresses
---@field createdDate? string ISO 8601 timestamp
---@field updatedDate? string ISO 8601 timestamp

---@class KrawletItem
---@field id string Item ID
---@field shopId string Parent shop ID
---@field itemName string Minecraft item name
---@field itemNbt? string NBT data
---@field itemDisplayName? string Display name
---@field itemDescription? string Item description
---@field shopBuysItem? boolean Whether shop buys this item
---@field noLimit? boolean No stock limit
---@field dynamicPrice boolean Dynamic pricing enabled
---@field madeOnDemand boolean Made on demand
---@field requiresInteraction boolean Requires player interaction
---@field stock number Current stock
---@field prices KrawletPrice[] Price list
---@field addresses string[] Associated Kromer addresses
---@field createdDate? string ISO 8601 timestamp
---@field updatedDate? string ISO 8601 timestamp

---@class KrawletPrice
---@field id string Price ID
---@field value number Price value
---@field currency string Currency type
---@field address? string Kromer address for payment
---@field requiredMeta? string Required metadata

---@class KrawletKnownAddress
---@field id string Address ID
---@field type string Address type (official/shop/gamble/service/company)
---@field address string 10-character Kromer address
---@field imageSrc? string Optional image URL
---@field name string Address name
---@field description string Address description
---@field createdDate? string ISO 8601 timestamp
---@field updatedDate? string ISO 8601 timestamp

---@class KrawletApiKeyInfo
---@field id string API key ID
---@field name string Key name/description
---@field email? string Associated email
---@field tier KrawletApiKeyTier Key tier
---@field rateLimit number Maximum requests per hour
---@field isActive boolean Whether key is active
---@field requestCount number Total requests made
---@field lastUsedAt? string Last usage timestamp
---@field createdAt string Creation timestamp
---@field usage? KrawletApiKeyUsage Usage statistics

---@class KrawletApiKeyUsage
---@field totalRequests number Total logged requests
---@field last24h number Requests in last 24 hours
---@field last7d number Requests in last 7 days
---@field last30d number Requests in last 30 days
---@field blockedRequests number Blocked request count
---@field avgResponseTimeMs? number Average response time
---@field topEndpoints table[] Top 5 endpoints

---@class KrawletQuickCode
---@field quickCode string 6-digit quick code
---@field expiresAt string Expiration timestamp
---@field expiresIn string Human-readable expiration
---@field message string Instructions

---@class KrawletQuickCodeRedeemed
---@field message string Success message
---@field apiKey string Full API key (kraw_...)
---@field name string Key name
---@field tier KrawletApiKeyTier Key tier
---@field rateLimit number Requests per hour
---@field warning string Warning to save key

---@alias KrawletServiceStatus "connected" | "disconnected" | "connecting" | "error"

---@class KrawletServiceInfo
---@field status KrawletServiceStatus Connection status
---@field lastError? string Last error message if any

---@class KrawletServiceInfoKromer : KrawletServiceInfo
---@field lastConnectedAt? string ISO 8601 timestamp of last connection
---@field lastTransactionId? number ID of last processed transaction

---@class KrawletServiceInfoChatbox : KrawletServiceInfo
---@field owner? string Chatbox owner name
---@field playerCount? number Number of online players

---@class KrawletServiceInfoDiscord : KrawletServiceInfo
---@field username? string Discord bot username
---@field commandCount? number Number of loaded commands

---@class KrawletHealthServices
---@field kromerWs KrawletServiceInfo Kromer WebSocket status
---@field chatbox KrawletServiceInfo Chatbox status
---@field discord KrawletServiceInfo Discord bot status

---@class KrawletHealthServicesDetailed
---@field kromerWs KrawletServiceInfoKromer Kromer WebSocket status (detailed)
---@field chatbox KrawletServiceInfoChatbox Chatbox status (detailed)
---@field discord KrawletServiceInfoDiscord Discord bot status (detailed)

---@class KrawletHealthData
---@field status string Health status (healthy/degraded)
---@field timestamp string ISO 8601 timestamp
---@field uptime number Server uptime in seconds
---@field version string API version
---@field name string API name
---@field services KrawletHealthServices Service connection statuses

---@class KrawletHealthChecks
---@field database boolean Database connection healthy
---@field memory boolean Memory usage healthy
---@field kromerWs boolean Kromer WebSocket connected
---@field chatbox boolean Chatbox connected
---@field discord boolean Discord bot connected

---@class KrawletHealthMemory
---@field heapUsed string Heap memory used (e.g., "50MB")
---@field heapTotal string Total heap memory (e.g., "100MB")
---@field rss string Resident set size (e.g., "120MB")

---@class KrawletHealthDetails
---@field timestamp string ISO 8601 timestamp
---@field uptime number Server uptime in seconds
---@field version string API version
---@field name string API name
---@field memory KrawletHealthMemory Memory usage info
---@field node string Node.js version
---@field platform string OS platform

---@class KrawletHealthDetailedData
---@field status string Health status (healthy/degraded)
---@field checks KrawletHealthChecks Health check results
---@field details KrawletHealthDetails Detailed server info
---@field services KrawletHealthServicesDetailed Detailed service statuses

-------------------------------------------------------------------------------
-- Module State
-------------------------------------------------------------------------------

---@class KrawletModule
---@field _endpoint string API base URL
---@field _apiKey? string API key for authentication
---@field _lastRateLimit? KrawletRateLimit Last rate limit info
---@field _debug boolean Debug mode flag
---@field VERSION string Module version
local krawlet = {
    _endpoint = "https://api.krawlet.cc",
    _apiKey = nil,
    _lastRateLimit = nil,
    _debug = false,
    VERSION = VERSION,
}

-------------------------------------------------------------------------------
-- Internal Helpers
-------------------------------------------------------------------------------

---Log debug message if debug mode is enabled
---@param ... any Values to print
local function debugLog(...)
    if krawlet._debug then
        print("[Krawlet]", ...)
    end
end

---Build headers for HTTP request
---@return table headers Request headers
local function buildHeaders()
    local headers = {
        ["Content-Type"] = "application/json",
        ["Accept"] = "application/json",
        ["User-Agent"] = "Krawlet-Lua/" .. VERSION .. " CC-Tweaked",
    }

    if krawlet._apiKey then
        headers["Authorization"] = "Bearer " .. krawlet._apiKey
    end

    return headers
end

---Parse rate limit headers from response
---@param response table HTTP response handle
---@return KrawletRateLimit|nil rateLimit Parsed rate limit info
local function parseRateLimitHeaders(response)
    if not response or not response.getResponseHeaders then
        return nil
    end

    local headers = response.getResponseHeaders()
    if not headers then
        return nil
    end

    local limit = headers["X-RateLimit-Limit"] or headers["x-ratelimit-limit"]
    local remaining = headers["X-RateLimit-Remaining"] or headers["x-ratelimit-remaining"]
    local reset = headers["X-RateLimit-Reset"] or headers["x-ratelimit-reset"]

    if limit and remaining and reset then
        return {
            limit = tonumber(limit) or 0,
            remaining = tonumber(remaining) or 0,
            reset = tonumber(reset) or 0,
        }
    end

    return nil
end

---Perform an HTTP request
---@param method string HTTP method (GET, POST, etc.)
---@param path string API path (without base URL)
---@param body? table Request body (will be JSON encoded)
---@return KrawletResponse response Parsed API response
local function httpRequest(method, path, body)
    local url = krawlet._endpoint .. path
    local headers = buildHeaders()
    local bodyStr = body and textutils.serialiseJSON(body) or nil

    debugLog(method, url)

    local response, err, errResponse

    if method == "GET" then
        response, err, errResponse = http.get(url, headers)
    elseif method == "POST" then
        response, err, errResponse = http.post(url, bodyStr, headers)
    else
        -- CC:Tweaked supports http.request for custom methods
        local ok = http.request({
            url = url,
            method = method,
            headers = headers,
            body = bodyStr or "{}",
        })

        if ok then
            -- Wait for http_success or http_failure event
            local event, eventUrl, handle
            repeat
                event, eventUrl, handle = os.pullEvent()
            until (event == "http_success" or event == "http_failure") and eventUrl == url

            if event == "http_success" then
                response = handle
            else
                errResponse = handle
            end
        end
    end

    -- Parse rate limit from response headers
    local rateLimit = parseRateLimitHeaders(response or errResponse)
    if rateLimit then
        krawlet._lastRateLimit = rateLimit
    end

    if response then
        local content = response.readAll()
        response.close()

        local success, data = pcall(textutils.unserialiseJSON, content)
        if success and data then
            debugLog("Response:", data.success and "success" or "error")
            return data
        end

        return {
            success = false,
            error = {
                code = "PARSE_ERROR",
                message = "Failed to parse API response",
            },
        }
    end

    -- Try to get error message from error response
    if errResponse then
        local content = errResponse.readAll()
        errResponse.close()

        local success, data = pcall(textutils.unserialiseJSON, content)
        if success and data then
            return data
        end
    end

    return {
        success = false,
        error = {
            code = "REQUEST_FAILED",
            message = err or "HTTP request failed",
        },
    }
end

---Build query string from parameters
---@param params table Query parameters
---@return string queryString URL-encoded query string (with leading ?)
local function buildQueryString(params)
    if not params or not next(params) then
        return ""
    end

    local parts = {}
    for key, value in pairs(params) do
        if value ~= nil then
            if type(value) == "table" then
                value = table.concat(value, ",")
            end
            table.insert(parts, textutils.urlEncode(tostring(key)) .. "=" .. textutils.urlEncode(tostring(value)))
        end
    end

    if #parts == 0 then
        return ""
    end

    return "?" .. table.concat(parts, "&")
end

-------------------------------------------------------------------------------
-- Configuration Functions
-------------------------------------------------------------------------------

---Set the API endpoint URL
---@param endpoint string Base URL (e.g., "https://api.krawlet.cc")
function krawlet.setEndpoint(endpoint)
    -- Remove trailing slash if present
    if endpoint:sub(-1) == "/" then
        endpoint = endpoint:sub(1, -2)
    end
    krawlet._endpoint = endpoint
end

---Get the current API endpoint
---@return string endpoint Current API endpoint URL
function krawlet.getEndpoint()
    return krawlet._endpoint
end

---Set the API key for authenticated requests
---@param apiKey string API key (format: kraw_...)
function krawlet.setApiKey(apiKey)
    krawlet._apiKey = apiKey
end

---Clear the API key
function krawlet.clearApiKey()
    krawlet._apiKey = nil
end

---Check if an API key is set
---@return boolean hasKey True if API key is configured
function krawlet.hasApiKey()
    return krawlet._apiKey ~= nil
end

---Enable or disable debug mode
---@param enabled boolean Whether to enable debug logging
function krawlet.setDebug(enabled)
    krawlet._debug = enabled
end

---Get the last rate limit information
---@return KrawletRateLimit|nil rateLimit Last rate limit info or nil
function krawlet.getRateLimit()
    return krawlet._lastRateLimit
end

-------------------------------------------------------------------------------
-- Health Check
-------------------------------------------------------------------------------

---Check API health status (basic)
---@return boolean healthy True if API is healthy
---@return KrawletHealthData|string data Health data on success, error message on failure
function krawlet.healthCheck()
    local response = httpRequest("GET", "/v1/health")

    if response.success then
        return true, response.data
    end

    return false, response.error and response.error.message or "Unknown error"
end

---Check API health status (detailed)
---Returns comprehensive health information including all service statuses
---@return boolean healthy True if API is healthy
---@return KrawletHealthDetailedData|string data Detailed health data on success, error message on failure
function krawlet.healthCheckDetailed()
    local response = httpRequest("GET", "/v1/health/detailed")

    if response.success then
        return true, response.data
    end

    return false, response.error and response.error.message or "Unknown error"
end

---Get the status of a specific service
---@param serviceName "kromerWs"|"chatbox"|"discord" Service to check
---@return KrawletServiceStatus|nil status Service status or nil on error
---@return string? error Error message if request failed
function krawlet.getServiceStatus(serviceName)
    local healthy, data = krawlet.healthCheck()

    if not healthy then
        return nil, type(data) == "string" and data or "Health check failed"
    end

    if type(data) == "table" and data.services and data.services[serviceName] then
        return data.services[serviceName].status
    end

    return nil, "Service not found: " .. tostring(serviceName)
end

---Check if all services are connected
---@return boolean allConnected True if all services are connected
---@return table<string, KrawletServiceStatus>? statuses Map of service names to statuses
function krawlet.areAllServicesConnected()
    local healthy, data = krawlet.healthCheck()

    if not healthy or type(data) ~= "table" or not data.services then
        return false, nil
    end

    local statuses = {}
    local allConnected = true

    for name, info in pairs(data.services) do
        statuses[name] = info.status
        if info.status ~= "connected" then
            allConnected = false
        end
    end

    return allConnected, statuses
end

-------------------------------------------------------------------------------
-- Player Functions
-------------------------------------------------------------------------------

---Get all players
---@return KrawletPlayer[]|nil players Array of players or nil on error
---@return string? error Error message if request failed
function krawlet.getPlayers()
    local response = httpRequest("GET", "/v1/players")

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Get player by Minecraft name
---@param name string Minecraft username
---@return KrawletPlayer|nil player Player data or nil if not found
---@return string? error Error message if request failed
function krawlet.getPlayerByName(name)
    local response = httpRequest("GET", "/v1/players" .. buildQueryString({ names = name }))

    if response.success and response.data and #response.data > 0 then
        return response.data[1]
    end

    return nil, response.error and response.error.message or "Player not found"
end

---Get players by multiple names
---@param names string[] Array of Minecraft usernames
---@return KrawletPlayer[]|nil players Array of players or nil on error
---@return string? error Error message if request failed
function krawlet.getPlayersByNames(names)
    local response = httpRequest("GET", "/v1/players" .. buildQueryString({ names = names }))

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Get player by UUID
---@param uuid string Minecraft UUID
---@return KrawletPlayer|nil player Player data or nil if not found
---@return string? error Error message if request failed
function krawlet.getPlayerByUUID(uuid)
    local response = httpRequest("GET", "/v1/players" .. buildQueryString({ uuids = uuid }))

    if response.success and response.data and #response.data > 0 then
        return response.data[1]
    end

    return nil, response.error and response.error.message or "Player not found"
end

---Get players by multiple UUIDs
---@param uuids string[] Array of Minecraft UUIDs
---@return KrawletPlayer[]|nil players Array of players or nil on error
---@return string? error Error message if request failed
function krawlet.getPlayersByUUIDs(uuids)
    local response = httpRequest("GET", "/v1/players" .. buildQueryString({ uuids = uuids }))

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Get player by Kromer address
---@param address string 10-character Kromer address
---@return KrawletPlayer|nil player Player data or nil if not found
---@return string? error Error message if request failed
function krawlet.getPlayerByAddress(address)
    local response = httpRequest("GET", "/v1/players" .. buildQueryString({ addresses = address }))

    if response.success and response.data and #response.data > 0 then
        return response.data[1]
    end

    return nil, response.error and response.error.message or "Player not found"
end

---Get players by multiple Kromer addresses
---@param addresses string[] Array of Kromer addresses
---@return KrawletPlayer[]|nil players Array of players or nil on error
---@return string? error Error message if request failed
function krawlet.getPlayersByAddresses(addresses)
    local response = httpRequest("GET", "/v1/players" .. buildQueryString({ addresses = addresses }))

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

-------------------------------------------------------------------------------
-- Shop Functions
-------------------------------------------------------------------------------

---Get all shops
---@return KrawletShop[]|nil shops Array of shops or nil on error
---@return string? error Error message if request failed
function krawlet.getShops()
    local response = httpRequest("GET", "/v1/shops")

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Get shop by ID
---@param id string|number Shop ID (computer ID)
---@return KrawletShop|nil shop Shop data or nil if not found
---@return string? error Error message if request failed
function krawlet.getShop(id)
    local response = httpRequest("GET", "/v1/shops/" .. tostring(id))

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Shop not found"
end

---Get items for a specific shop
---@param shopId string|number Shop ID
---@return KrawletItem[]|nil items Array of items or nil on error
---@return string? error Error message if request failed
function krawlet.getShopItems(shopId)
    local response = httpRequest("GET", "/shops/" .. tostring(shopId) .. "/items")

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Search shops by name (case-insensitive partial match)
---@param query string Search query
---@return KrawletShop[]|nil shops Matching shops or nil on error
---@return string? error Error message if request failed
function krawlet.searchShops(query)
    local shops, err = krawlet.getShops()
    if not shops then
        return nil, err
    end

    local results = {}
    local queryLower = query:lower()

    for _, shop in ipairs(shops) do
        if shop.name and shop.name:lower():find(queryLower, 1, true) then
            table.insert(results, shop)
        end
    end

    return results
end

-------------------------------------------------------------------------------
-- Item Functions
-------------------------------------------------------------------------------

---Get all items across all shops
---@return KrawletItem[]|nil items Array of items or nil on error
---@return string? error Error message if request failed
function krawlet.getItems()
    local response = httpRequest("GET", "/v1/items")

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Search items by name (case-insensitive partial match)
---@param query string Search query
---@return KrawletItem[]|nil items Matching items or nil on error
---@return string? error Error message if request failed
function krawlet.searchItems(query)
    local items, err = krawlet.getItems()
    if not items then
        return nil, err
    end

    local results = {}
    local queryLower = query:lower()

    for _, item in ipairs(items) do
        local displayName = (item.itemDisplayName or ""):lower()
        local itemName = (item.itemName or ""):lower()
        if displayName:find(queryLower, 1, true) or itemName:find(queryLower, 1, true) then
            table.insert(results, item)
        end
    end

    return results
end

---Find items with the best prices (lowest buy price)
---@param itemName string Item name to search
---@param currency? string Currency filter (default: "KRO")
---@param limit? number Maximum results (default: 10)
---@return table[]|nil results Sorted results with item and shop info
---@return string? error Error message if request failed
function krawlet.findBestPrices(itemName, currency, limit)
    currency = currency or "KRO"
    limit = limit or 10

    local items, err = krawlet.searchItems(itemName)
    if not items then
        return nil, err
    end

    local shops, shopErr = krawlet.getShops()
    if not shops then
        return nil, shopErr
    end

    -- Build shop lookup
    local shopLookup = {}
    for _, shop in ipairs(shops) do
        shopLookup[shop.id] = shop
    end

    -- Collect prices
    local results = {}
    for _, item in ipairs(items) do
        if item.prices then
            for _, price in ipairs(item.prices) do
                if price.currency == currency and not item.shopBuysItem then
                    local shop = shopLookup[item.shopId]
                    table.insert(results, {
                        item = item,
                        price = price.value,
                        currency = price.currency,
                        shop = shop,
                        stock = item.stock,
                    })
                end
            end
        end
    end

    -- Sort by price (ascending)
    table.sort(results, function(a, b)
        return a.price < b.price
    end)

    -- Limit results
    if #results > limit then
        local limited = {}
        for i = 1, limit do
            limited[i] = results[i]
        end
        return limited
    end

    return results
end

---Find shops that buy a specific item (best sell prices)
---@param itemName string Item name to search
---@param currency? string Currency filter (default: "KRO")
---@param limit? number Maximum results (default: 10)
---@return table[]|nil results Sorted results with item and shop info
---@return string? error Error message if request failed
function krawlet.findBestSellPrices(itemName, currency, limit)
    currency = currency or "KRO"
    limit = limit or 10

    local items, err = krawlet.searchItems(itemName)
    if not items then
        return nil, err
    end

    local shops, shopErr = krawlet.getShops()
    if not shops then
        return nil, shopErr
    end

    -- Build shop lookup
    local shopLookup = {}
    for _, shop in ipairs(shops) do
        shopLookup[shop.id] = shop
    end

    -- Collect prices (only where shop buys item)
    local results = {}
    for _, item in ipairs(items) do
        if item.shopBuysItem and item.prices then
            for _, price in ipairs(item.prices) do
                if price.currency == currency then
                    local shop = shopLookup[item.shopId]
                    table.insert(results, {
                        item = item,
                        price = price.value,
                        currency = price.currency,
                        shop = shop,
                        noLimit = item.noLimit,
                    })
                end
            end
        end
    end

    -- Sort by price (descending - highest buy price first)
    table.sort(results, function(a, b)
        return a.price > b.price
    end)

    -- Limit results
    if #results > limit then
        local limited = {}
        for i = 1, limit do
            limited[i] = results[i]
        end
        return limited
    end

    return results
end

-------------------------------------------------------------------------------
-- Known Addresses Functions
-------------------------------------------------------------------------------

---Get all known addresses
---@return KrawletKnownAddress[]|nil addresses Array of known addresses or nil on error
---@return string? error Error message if request failed
function krawlet.getKnownAddresses()
    local response = httpRequest("GET", "/v1/addresses")

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Look up a known address
---@param address string 10-character Kromer address
---@return KrawletKnownAddress|nil knownAddress Known address info or nil if not found
---@return string? error Error message if request failed
function krawlet.lookupAddress(address)
    local addresses, err = krawlet.getKnownAddresses()
    if not addresses then
        return nil, err
    end

    for _, known in ipairs(addresses) do
        if known.address == address then
            return known
        end
    end

    return nil, "Address not found in known addresses"
end

---Get known addresses by type
---@param addressType string Address type (official/shop/gamble/service/company)
---@return KrawletKnownAddress[]|nil addresses Filtered addresses or nil on error
---@return string? error Error message if request failed
function krawlet.getAddressesByType(addressType)
    local addresses, err = krawlet.getKnownAddresses()
    if not addresses then
        return nil, err
    end

    local results = {}
    for _, known in ipairs(addresses) do
        if known.type == addressType then
            table.insert(results, known)
        end
    end

    return results
end

-------------------------------------------------------------------------------
-- Ender Storage Functions
-------------------------------------------------------------------------------

---Get ender storage data
---@return table|nil data Ender storage data or nil on error
---@return string? error Error message if request failed
function krawlet.getEnderStorage()
    local response = httpRequest("GET", "/v1/storage")

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

-------------------------------------------------------------------------------
-- Reports Functions
-------------------------------------------------------------------------------

---Get report statistics
---@return table|nil stats Report statistics or nil on error
---@return string? error Error message if request failed
function krawlet.getReportStats()
    local response = httpRequest("GET", "/v1/reports/stats")

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Get shop change logs
---@param options? table Options: limit, offset, shopId, since, until
---@return table|nil result Table with count (number of logs in response), total (total matching logs), and logs array, or nil on error
---@return string? error Error message if request failed
function krawlet.getShopChangeLogs(options)
    local query = buildQueryString(options or {})
    local response = httpRequest("GET", "/v1/reports/shop-change-logs" .. query)

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Get item change logs
---@param options? table Options: limit, offset, shopId, since, until
---@return table|nil result Table with count (number of logs in response), total (total matching logs), and logs array, or nil on error
---@return string? error Error message if request failed
function krawlet.getItemChangeLogs(options)
    local query = buildQueryString(options or {})
    local response = httpRequest("GET", "/v1/reports/item-change-logs" .. query)

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Get price change logs
---@param options? table Options: limit, offset, shopId, since, until
---@return table|nil result Table with count (number of logs in response), total (total matching logs), and logs array, or nil on error
---@return string? error Error message if request failed
function krawlet.getPriceChangeLogs(options)
    local query = buildQueryString(options or {})
    local response = httpRequest("GET", "/v1/reports/price-change-logs" .. query)

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

-------------------------------------------------------------------------------
-- API Key Functions
-------------------------------------------------------------------------------

---Get current API key information (requires authentication)
---@param includeUsage? boolean Include usage statistics (default: true)
---@return KrawletApiKeyInfo|nil info API key info or nil on error
---@return string? error Error message if request failed
function krawlet.getApiKeyInfo(includeUsage)
    if not krawlet._apiKey then
        return nil, "API key required"
    end

    local query = ""
    if includeUsage == false then
        query = buildQueryString({ usage = "false" })
    end

    local response = httpRequest("GET", "/v1/apikey" .. query)

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Get API key usage statistics (requires authentication)
---@return KrawletApiKeyUsage|nil usage Usage stats or nil on error
---@return string? error Error message if request failed
function krawlet.getApiKeyUsage()
    if not krawlet._apiKey then
        return nil, "API key required"
    end

    local response = httpRequest("GET", "/v1/apikey/usage")

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Get API key request logs (requires authentication)
---@param limit? number Maximum logs to return (max 100, default 50)
---@return table|nil logs Request logs or nil on error
---@return string? error Error message if request failed
function krawlet.getApiKeyLogs(limit)
    if not krawlet._apiKey then
        return nil, "API key required"
    end

    local query = limit and buildQueryString({ limit = limit }) or ""
    local response = httpRequest("GET", "/v1/apikey/logs" .. query)

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Generate a quick code for the current API key (requires authentication)
---@return KrawletQuickCode|nil quickCode Quick code info or nil on error
---@return string? error Error message if request failed
function krawlet.generateQuickCode()
    if not krawlet._apiKey then
        return nil, "API key required"
    end

    local response = httpRequest("POST", "/v1/apikey/quickcode/generate")

    if response.success then
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

---Redeem a quick code to get an API key
---Note: This will regenerate the API key, invalidating the old one
---@param code string 6-digit quick code
---@return KrawletQuickCodeRedeemed|nil result Redeemed key info or nil on error
---@return string? error Error message if request failed
function krawlet.redeemQuickCode(code)
    local response = httpRequest("POST", "/v1/apikey/quickcode/redeem", { code = code })

    if response.success then
        -- Optionally auto-set the new API key
        if response.data and response.data.apiKey then
            krawlet.setApiKey(response.data.apiKey)
        end
        return response.data
    end

    return nil, response.error and response.error.message or "Unknown error"
end

-------------------------------------------------------------------------------
-- Utility Functions
-------------------------------------------------------------------------------

---Format a Kromer value with currency symbol
---@param value number Kromer value
---@param decimals? number Decimal places (default: 2)
---@return string formatted Formatted string (e.g., "1,234.56 KRO")
function krawlet.formatKromer(value, decimals)
    decimals = decimals or 2

    -- Handle negative values
    local negative = value < 0
    value = math.abs(value)

    -- Round to specified decimals
    local mult = 10 ^ decimals
    value = math.floor(value * mult + 0.5) / mult

    -- Split integer and decimal parts
    local intPart = math.floor(value)
    local decPart = value - intPart

    -- Format integer with commas
    local formatted = tostring(intPart):reverse():gsub("(%d%d%d)", "%1,"):reverse():gsub("^,", "")

    -- Add decimal part
    if decimals > 0 then
        local decStr = string.format("%." .. decimals .. "f", decPart):sub(3)
        formatted = formatted .. "." .. decStr
    end

    if negative then
        formatted = "-" .. formatted
    end

    return formatted .. " KRO"
end

---Parse an item string (e.g., "minecraft:diamond" -> {mod = "minecraft", item = "diamond"})
---@param itemString string Full item name
---@return table parsed Parsed item {mod, item, full}
function krawlet.parseItemName(itemString)
    local mod, item = itemString:match("^([^:]+):(.+)$")
    if mod and item then
        return { mod = mod, item = item, full = itemString }
    end
    return { mod = "minecraft", item = itemString, full = "minecraft:" .. itemString }
end

---Pretty print a table (for debugging)
---@param tbl table Table to print
---@param indent? number Indentation level
function krawlet.prettyPrint(tbl, indent)
    indent = indent or 0
    local prefix = string.rep("  ", indent)

    if type(tbl) ~= "table" then
        print(prefix .. tostring(tbl))
        return
    end

    for k, v in pairs(tbl) do
        if type(v) == "table" then
            print(prefix .. tostring(k) .. ":")
            krawlet.prettyPrint(v, indent + 1)
        else
            print(prefix .. tostring(k) .. ": " .. tostring(v))
        end
    end
end

---Get the response metadata from the last request
---@return KrawletMeta|nil meta Last response metadata
function krawlet.getLastMeta()
    return krawlet._lastMeta
end

-------------------------------------------------------------------------------
-- Installer / Updater
-------------------------------------------------------------------------------

---Download and install/update the Krawlet library
---@param path? string Installation path (default: "/krawlet.lua")
---@return boolean success True if installation succeeded
---@return string message Success or error message
function krawlet.install(path)
    path = path or "/krawlet.lua"

    local url = "https://krawlet.cc/krawlet.lua"
    local response, err = http.get(url)

    if not response then
        return false, "Failed to download: " .. (err or "unknown error")
    end

    local content = response.readAll()
    response.close()

    if not content or #content < 100 then
        return false, "Downloaded file appears to be invalid"
    end

    local file = fs.open(path, "w")
    if not file then
        return false, "Failed to open file for writing: " .. path
    end

    file.write(content)
    file.close()

    return true, "Krawlet library installed to " .. path
end

---Check for updates to the Krawlet library
---@return boolean hasUpdate True if update is available
---@return string|nil newVersion New version string if available
function krawlet.checkForUpdate()
    local url = "https://api.krawlet.cc/v1/health"
    local response = http.get(url)

    if response then
        local content = response.readAll()
        response.close()

        local success, data = pcall(textutils.unserialiseJSON, content)
        if success and data and data.meta and data.meta.version then
            local serverVersion = data.meta.version
            if serverVersion ~= VERSION then
                return true, serverVersion
            end
        end
    end

    return false, nil
end

-------------------------------------------------------------------------------
-- Debug Functions
-------------------------------------------------------------------------------

---Print debug information about the library state
function krawlet._dumpState()
    print("=== Krawlet Library State ===")
    print("Version:", VERSION)
    print("Endpoint:", krawlet._endpoint)
    print("API Key:", krawlet._apiKey and (krawlet._apiKey:sub(1, 10) .. "...") or "not set")
    print("Debug:", krawlet._debug)

    if krawlet._lastRateLimit then
        print("\nLast Rate Limit:")
        print("  Limit:", krawlet._lastRateLimit.limit)
        print("  Remaining:", krawlet._lastRateLimit.remaining)
        print("  Reset:", krawlet._lastRateLimit.reset)
    end

    print("=============================")
end

return krawlet
