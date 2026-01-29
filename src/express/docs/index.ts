import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

const router = Router();

// Load OpenAPI spec from project root (works in both dev and dist)
const openapiPath = join(process.cwd(), 'openapi.yaml');
const openapiFile = readFileSync(openapiPath, 'utf8');
const openapiSpec = YAML.parse(openapiFile);

// Load Krawlet Lua library
const krawletLuaPath = join(process.cwd(), 'lua', 'krawlet.lua');
let krawletLuaContent = '';
if (existsSync(krawletLuaPath)) {
  krawletLuaContent = readFileSync(krawletLuaPath, 'utf8');
}

// Serve the OpenAPI spec as JSON
router.get('/docs/v1/openapi.json', (req, res) => {
  res.json(openapiSpec);
});

// Serve the Krawlet Lua library for CC: Tweaked
router.get('/krawlet.lua', (req, res) => {
  if (!krawletLuaContent) {
    return res.status(404).send('-- Krawlet Lua library not found');
  }
  res.type('text/x-lua');
  res.set('Content-Disposition', 'inline; filename="krawlet.lua"');
  res.send(krawletLuaContent);
});

// Documentation index page at root
router.get('/', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Krawlet API Documentation</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          max-width: 900px;
          margin: 0 auto;
          padding: 2rem 1rem;
          line-height: 1.6;
          color: #24292e;
          background: #fff;
        }
        h1 {
          font-size: 2rem;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        .subtitle {
          color: #586069;
          margin-bottom: 2rem;
        }
        .section {
          border: 1px solid #d1d5da;
          border-radius: 6px;
          padding: 1.5rem;
          margin-bottom: 1rem;
        }
        .section h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 600;
        }
        .section h2 a {
          color: #0366d6;
          text-decoration: none;
        }
        .section h2 a:hover {
          text-decoration: underline;
        }
        .badge {
          background: #28a745;
          color: white;
          padding: 2px 7px;
          border-radius: 3px;
          font-size: 12px;
          font-weight: 600;
          margin-left: 8px;
        }
        .badge-lua {
          background: #000080;
        }
        .features {
          color: #586069;
          margin: 0.5rem 0 0 0;
          padding: 0;
          list-style: none;
        }
        .features li {
          padding: 0.25rem 0;
        }
        .code-block {
          background: #f6f8fa;
          border-radius: 6px;
          padding: 1rem;
          margin-top: 1rem;
          font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
          font-size: 0.85rem;
          overflow-x: auto;
        }
        .code-block code {
          color: #24292e;
        }
        .footer {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid #e1e4e8;
          color: #586069;
          font-size: 0.875rem;
        }
        .footer a {
          color: #0366d6;
          text-decoration: none;
        }
        .footer a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <h1>Krawlet API Documentation</h1>
      <p class="subtitle">Minecraft economy tracking system</p>
      
      <div class="section">
        <h2>
          <a href="/docs/v1">REST API v1</a>
          <span class="badge">STABLE</span>
        </h2>
        <p>REST API with authentication, rate limiting, and comprehensive endpoints for shop tracking, item management, and player data.</p>
        <ul class="features">
          <li>✓ Shop and item tracking</li>
          <li>✓ Player address management</li>
          <li>✓ Reports and analytics</li>
          <li>✓ API key management</li>
        </ul>
      </div>

      <div class="section">
        <h2>
          <a href="/docs/lua">Lua Library</a>
          <span class="badge badge-lua">CC: TWEAKED</span>
        </h2>
        <p>Lua client library for CC: Tweaked (Minecraft 1.20.1+). Easy integration with ComputerCraft computers and turtles.</p>
        <ul class="features">
          <li>✓ Full API coverage</li>
          <li>✓ Type annotations for IDE support</li>
          <li>✓ Price comparison utilities</li>
          <li>✓ Quick code authentication</li>
        </ul>
        <div class="code-block">
          <code>wget run https://krawlet.cc/krawlet.lua</code>
        </div>
      </div>

      <div class="footer">
        <a href="https://github.com/Twijn/krawlet-api" target="_blank">GitHub</a> · 
        <a href="https://api.krawlet.cc/api/v1" target="_blank">API Root</a> ·
        <a href="/krawlet.lua" target="_blank">Download Lua Library</a>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// Redirect /docs to current stable version
router.get('/docs', (req, res) => {
  res.redirect('/docs/v1');
});

// Lua library documentation
router.get('/docs/lua', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Krawlet Lua Library - CC: Tweaked</title>
      <style>
        :root {
          --bg: #0d1117;
          --bg-secondary: #161b22;
          --border: #30363d;
          --text: #c9d1d9;
          --text-muted: #8b949e;
          --link: #58a6ff;
          --code-bg: #1f2428;
          --accent: #238636;
          --accent-lua: #000080;
        }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          max-width: 1000px;
          margin: 0 auto;
          padding: 2rem 1rem;
          line-height: 1.6;
          color: var(--text);
          background: var(--bg);
        }
        a { color: var(--link); text-decoration: none; }
        a:hover { text-decoration: underline; }
        h1 { font-size: 2rem; margin-bottom: 0.25rem; color: #fff; }
        h2 { font-size: 1.5rem; margin-top: 2.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); color: #fff; }
        h3 { font-size: 1.2rem; margin-top: 1.5rem; color: #fff; }
        .subtitle { color: var(--text-muted); margin-bottom: 1.5rem; }
        .nav { margin-bottom: 2rem; padding: 1rem; background: var(--bg-secondary); border-radius: 6px; border: 1px solid var(--border); }
        .nav a { margin-right: 1rem; }
        .badge { background: var(--accent-lua); color: white; padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: 600; margin-left: 8px; }
        pre { background: var(--code-bg); border: 1px solid var(--border); border-radius: 6px; padding: 1rem; overflow-x: auto; margin: 1rem 0; }
        code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: 0.9rem; }
        :not(pre) > code { background: var(--code-bg); padding: 0.2em 0.4em; border-radius: 3px; }
        .install-box { background: var(--bg-secondary); border: 2px solid var(--accent); border-radius: 6px; padding: 1.5rem; margin: 1.5rem 0; }
        .install-box h3 { margin-top: 0; color: #fff; }
        .method { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; margin: 1rem 0; padding: 1rem 1.25rem; }
        .method-sig { font-family: "SFMono-Regular", Consolas, monospace; color: var(--link); font-weight: 600; margin-bottom: 0.5rem; }
        .method-desc { color: var(--text-muted); margin-bottom: 0.5rem; }
        .method-returns { color: var(--text-muted); font-size: 0.9rem; }
        .method-returns span { color: #f0883e; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { text-align: left; padding: 0.75rem; border: 1px solid var(--border); }
        th { background: var(--bg-secondary); color: #fff; }
        .example { margin: 1.5rem 0; }
        .toc { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 1rem 1.5rem; margin: 1.5rem 0; }
        .toc h4 { margin: 0 0 0.5rem 0; color: #fff; }
        .toc ul { margin: 0; padding-left: 1.25rem; }
        .toc li { padding: 0.25rem 0; }
      </style>
    </head>
    <body>
      <div class="nav">
        <a href="/">← Back to Docs</a>
        <a href="/docs/v1">REST API v1</a>
        <a href="/krawlet.lua">Download krawlet.lua</a>
      </div>

      <h1>Krawlet Lua Library <span class="badge">CC: TWEAKED</span></h1>
      <p class="subtitle">A comprehensive Lua client library for the Krawlet API, designed for CC: Tweaked (Minecraft 1.20.1+)</p>

      <div class="install-box">
        <h3>⚡ Quick Install</h3>
        <p>Run this command on any CC: Tweaked computer:</p>
        <pre><code>wget https://krawlet.cc/krawlet.lua /krawlet.lua</code></pre>
        <p style="margin-bottom: 0; color: var(--text-muted);">Or use wget run for a one-liner install script.</p>
      </div>

      <div class="toc">
        <h4>Table of Contents</h4>
        <ul>
          <li><a href="#getting-started">Getting Started</a></li>
          <li><a href="#configuration">Configuration</a></li>
          <li><a href="#players">Player Functions</a></li>
          <li><a href="#shops">Shop Functions</a></li>
          <li><a href="#items">Item Functions</a></li>
          <li><a href="#addresses">Known Addresses</a></li>
          <li><a href="#apikey">API Key Management</a></li>
          <li><a href="#utilities">Utility Functions</a></li>
        </ul>
      </div>

      <h2 id="getting-started">Getting Started</h2>
      <p>After installing the library, you can use it in any Lua program:</p>
      <pre><code>local krawlet = require("krawlet")

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
end</code></pre>

      <h2 id="configuration">Configuration</h2>
      
      <div class="method">
        <div class="method-sig">krawlet.setEndpoint(endpoint)</div>
        <div class="method-desc">Set the API endpoint URL. Defaults to production (<code>https://api.krawlet.cc/api</code>).</div>
        <div class="method-returns">Parameters: <span>endpoint</span> (string) - Base URL</div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.setApiKey(apiKey)</div>
        <div class="method-desc">Set the API key for authenticated requests. Required for API key management endpoints.</div>
        <div class="method-returns">Parameters: <span>apiKey</span> (string) - Your API key (format: kraw_...)</div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.setDebug(enabled)</div>
        <div class="method-desc">Enable or disable debug logging.</div>
        <div class="method-returns">Parameters: <span>enabled</span> (boolean)</div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.getRateLimit()</div>
        <div class="method-desc">Get the last rate limit information from API responses.</div>
        <div class="method-returns">Returns: <span>table|nil</span> - {limit, remaining, reset}</div>
      </div>

      <h2 id="players">Player Functions</h2>

      <div class="method">
        <div class="method-sig">krawlet.getPlayers()</div>
        <div class="method-desc">Get all registered players.</div>
        <div class="method-returns">Returns: <span>table[]|nil</span>, <span>string?</span> (error)</div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.getPlayerByName(name)</div>
        <div class="method-desc">Get a player by their Minecraft username.</div>
        <div class="method-returns">Parameters: <span>name</span> (string) | Returns: <span>table|nil</span>, <span>string?</span></div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.getPlayerByUUID(uuid)</div>
        <div class="method-desc">Get a player by their Minecraft UUID.</div>
        <div class="method-returns">Parameters: <span>uuid</span> (string) | Returns: <span>table|nil</span>, <span>string?</span></div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.getPlayerByAddress(address)</div>
        <div class="method-desc">Get a player by their Kromer address.</div>
        <div class="method-returns">Parameters: <span>address</span> (string) | Returns: <span>table|nil</span>, <span>string?</span></div>
      </div>

      <div class="example">
        <h4>Example: Player Lookup</h4>
        <pre><code>local krawlet = require("krawlet")

-- Look up a player by name
local player, err = krawlet.getPlayerByName("Twijn")
if player then
    print("Player: " .. player.minecraftName)
    print("Address: " .. player.kromerAddress)
    print("Online: " .. tostring(player.online))
else
    print("Error: " .. (err or "Player not found"))
end</code></pre>
      </div>

      <h2 id="shops">Shop Functions</h2>

      <div class="method">
        <div class="method-sig">krawlet.getShops()</div>
        <div class="method-desc">Get all shops with their items and addresses.</div>
        <div class="method-returns">Returns: <span>table[]|nil</span>, <span>string?</span></div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.getShop(id)</div>
        <div class="method-desc">Get a specific shop by its ID (computer ID).</div>
        <div class="method-returns">Parameters: <span>id</span> (string|number) | Returns: <span>table|nil</span>, <span>string?</span></div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.searchShops(query)</div>
        <div class="method-desc">Search shops by name (case-insensitive partial match).</div>
        <div class="method-returns">Parameters: <span>query</span> (string) | Returns: <span>table[]|nil</span>, <span>string?</span></div>
      </div>

      <h2 id="items">Item Functions</h2>

      <div class="method">
        <div class="method-sig">krawlet.getItems()</div>
        <div class="method-desc">Get all items across all shops.</div>
        <div class="method-returns">Returns: <span>table[]|nil</span>, <span>string?</span></div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.searchItems(query)</div>
        <div class="method-desc">Search items by name (case-insensitive partial match).</div>
        <div class="method-returns">Parameters: <span>query</span> (string) | Returns: <span>table[]|nil</span>, <span>string?</span></div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.findBestPrices(itemName, currency?, limit?)</div>
        <div class="method-desc">Find items with the lowest buy prices. Great for finding deals!</div>
        <div class="method-returns">Parameters: <span>itemName</span>, <span>currency</span> (default: "KST"), <span>limit</span> (default: 10) | Returns: <span>table[]|nil</span></div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.findBestSellPrices(itemName, currency?, limit?)</div>
        <div class="method-desc">Find shops that buy items at the highest prices.</div>
        <div class="method-returns">Parameters: <span>itemName</span>, <span>currency</span> (default: "KST"), <span>limit</span> (default: 10) | Returns: <span>table[]|nil</span></div>
      </div>

      <div class="example">
        <h4>Example: Price Comparison</h4>
        <pre><code>local krawlet = require("krawlet")

-- Find the best prices for diamonds
local deals = krawlet.findBestPrices("diamond", "KST", 5)
if deals then
    print("Best diamond prices:")
    for i, deal in ipairs(deals) do
        local shopName = deal.shop and deal.shop.name or "Unknown Shop"
        print(string.format("%d. %s - %s KST (stock: %d)", 
            i, shopName, krawlet.formatKromer(deal.price), deal.stock or 0))
    end
end

-- Find where to sell iron ingots
local sellDeals = krawlet.findBestSellPrices("iron_ingot")
if sellDeals and #sellDeals > 0 then
    local best = sellDeals[1]
    print("Best place to sell iron: " .. (best.shop and best.shop.name or "Unknown"))
    print("Price: " .. krawlet.formatKromer(best.price))
end</code></pre>
      </div>

      <h2 id="addresses">Known Addresses</h2>

      <div class="method">
        <div class="method-sig">krawlet.getKnownAddresses()</div>
        <div class="method-desc">Get all known/verified Kromer addresses.</div>
        <div class="method-returns">Returns: <span>table[]|nil</span>, <span>string?</span></div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.lookupAddress(address)</div>
        <div class="method-desc">Look up information about a known address.</div>
        <div class="method-returns">Parameters: <span>address</span> (string) | Returns: <span>table|nil</span>, <span>string?</span></div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.getAddressesByType(type)</div>
        <div class="method-desc">Get known addresses filtered by type (official, shop, gamble, service, company).</div>
        <div class="method-returns">Parameters: <span>type</span> (string) | Returns: <span>table[]|nil</span>, <span>string?</span></div>
      </div>

      <h2 id="apikey">API Key Management</h2>

      <div class="method">
        <div class="method-sig">krawlet.redeemQuickCode(code)</div>
        <div class="method-desc">Redeem a 6-digit quick code to receive a full API key. The quick code can be obtained via the \\krawlet api chatbox command.</div>
        <div class="method-returns">Parameters: <span>code</span> (string - 6 digits) | Returns: <span>table|nil</span>, <span>string?</span></div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.getApiKeyInfo(includeUsage?)</div>
        <div class="method-desc">Get information about your current API key. Requires authentication.</div>
        <div class="method-returns">Parameters: <span>includeUsage</span> (boolean, default: true) | Returns: <span>table|nil</span>, <span>string?</span></div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.getApiKeyUsage()</div>
        <div class="method-desc">Get detailed usage statistics for your API key. Requires authentication.</div>
        <div class="method-returns">Returns: <span>table|nil</span>, <span>string?</span></div>
      </div>

      <div class="example">
        <h4>Example: Quick Code Authentication</h4>
        <pre><code>local krawlet = require("krawlet")

-- Redeem a quick code from \\krawlet api chat command
local result, err = krawlet.redeemQuickCode("123456")
if result then
    print("API Key received!")
    print("Tier: " .. result.tier)
    print("Rate Limit: " .. result.rateLimit .. " requests/hour")
    -- The API key is automatically set on success
    -- Save it to a file for future use:
    local f = fs.open("/.krawlet_key", "w")
    f.write(result.apiKey)
    f.close()
else
    print("Error: " .. (err or "Failed to redeem code"))
end</code></pre>
      </div>

      <h2 id="utilities">Utility Functions</h2>

      <div class="method">
        <div class="method-sig">krawlet.healthCheck()</div>
        <div class="method-desc">Check if the API is online and healthy.</div>
        <div class="method-returns">Returns: <span>boolean</span> (healthy), <span>string</span> (status or error)</div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.formatKromer(value, decimals?)</div>
        <div class="method-desc">Format a number as a Kromer currency string with commas.</div>
        <div class="method-returns">Parameters: <span>value</span> (number), <span>decimals</span> (default: 2) | Returns: <span>string</span> (e.g., "1,234.56 KST")</div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.parseItemName(itemString)</div>
        <div class="method-desc">Parse a Minecraft item string into its components.</div>
        <div class="method-returns">Parameters: <span>itemString</span> (e.g., "minecraft:diamond") | Returns: <span>table</span> {mod, item, full}</div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.prettyPrint(table, indent?)</div>
        <div class="method-desc">Pretty print a table for debugging.</div>
        <div class="method-returns">Parameters: <span>table</span>, <span>indent</span> (number)</div>
      </div>

      <div class="method">
        <div class="method-sig">krawlet.install(path?)</div>
        <div class="method-desc">Download and install/update the Krawlet library.</div>
        <div class="method-returns">Parameters: <span>path</span> (default: "/krawlet.lua") | Returns: <span>boolean</span>, <span>string</span></div>
      </div>

      <h2>Complete Example</h2>
      <pre><code>-- shop_finder.lua
-- A program to find the best prices for items

local krawlet = require("krawlet")

-- Load saved API key if exists
if fs.exists("/.krawlet_key") then
    local f = fs.open("/.krawlet_key", "r")
    krawlet.setApiKey(f.readAll())
    f.close()
end

-- Main program
print("=== Krawlet Shop Finder ===")
print()

while true do
    write("Search for item (or 'quit'): ")
    local query = read()
    
    if query == "quit" or query == "exit" then
        break
    end
    
    print("Searching...")
    local deals = krawlet.findBestPrices(query, "KST", 5)
    
    if not deals or #deals == 0 then
        print("No results found for '" .. query .. "'")
    else
        print()
        print("Top 5 deals for '" .. query .. "':")
        print(string.rep("-", 50))
        
        for i, deal in ipairs(deals) do
            local name = deal.item.itemDisplayName or deal.item.itemName
            local shopName = deal.shop and deal.shop.name or "Unknown"
            local location = deal.shop and deal.shop.locationDescription or "Unknown location"
            
            print(string.format("%d. %s", i, name))
            print(string.format("   Shop: %s", shopName))
            print(string.format("   Price: %s", krawlet.formatKromer(deal.price)))
            print(string.format("   Stock: %d", deal.stock or 0))
            print(string.format("   Location: %s", location))
            print()
        end
    end
    
    -- Show rate limit info
    local rl = krawlet.getRateLimit()
    if rl then
        print(string.format("Rate limit: %d/%d remaining", rl.remaining, rl.limit))
    end
    print()
end

print("Goodbye!")</code></pre>

      <div class="nav" style="margin-top: 3rem;">
        <a href="/">← Back to Docs</a>
        <a href="/docs/v1">REST API v1</a>
        <a href="/krawlet.lua">Download krawlet.lua</a>
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

// Swagger UI options
const swaggerOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    .swagger-ui .info .title { font-size: 2.5rem; }
    .swagger-ui .scheme-container { background: #fafafa; padding: 1rem; border-radius: 4px; }
  `,
  customSiteTitle: 'Krawlet API v1 Documentation',
  explorer: false,
  swaggerUrl: '/docs/v1/openapi.json',
};

// Serve v1 docs at /docs/v1
router.use('/docs/v1', swaggerUi.serve, swaggerUi.setup(null, swaggerOptions));

export default router;
