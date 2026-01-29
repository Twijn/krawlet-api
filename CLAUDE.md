# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Krawlet API is a TypeScript Node.js application that provides API and bot services for the Krist economy system in a Minecraft server. It integrates with the Kromer API (kromer.club), Discord bot, in-game chat (ReconnectedChat), and WebSocket services for real-time transaction monitoring.

## Common Commands

### Development
```bash
pnpm run dev          # Build and start the server
pnpm run build        # Compile TypeScript to dist/
pnpm run start        # Run compiled JavaScript from dist/
pnpm run clean        # Remove dist/ folder
```

### Database Migrations (Sequelize)
```bash
pnpm run migrate                        # Run all pending migrations
pnpm run migrate:create -- <name>       # Create a new migration
pnpm run migrate:undo                   # Rollback last migration
```

### Code Quality
```bash
pnpm run lint         # Run ESLint (quiet mode)
pnpm run lint:fix     # Fix ESLint issues automatically
pnpm run format       # Format code with Prettier
```

### Utilities
```bash
pnpm run gen-apikey           # Generate a new API key interactively
pnpm run apikey-info          # Get information about an API key
pnpm run deploy-commands      # Deploy Discord slash commands to Discord
```

## Architecture

### Entry Point
`src/index.ts` is the main entry point that initializes all subsystems via side-effect imports:
- Loads environment variables via dotenv
- Imports chat, express, kromerWs, and discord modules
- Each subsystem starts independently

### Four Main Subsystems

**1. Express API (`src/express/`)**
- Serves REST API endpoints and Swagger documentation
- Documentation at root (`/`), API at `/api/v1`
- Legacy endpoints available at both root and `/api` for backward compatibility
- V1 middleware chain (in order):
  1. Request ID generation
  2. Response formatter (adds `res.success()` and `res.error()` methods)
  3. Optional API key authentication (allows anonymous + authenticated)
  4. Rate limiter (tiered based on API key tier)

**2. Discord Bot (`src/discord/`)**
- Slash command interface for economy queries
- Commands implement `DiscordCommand` interface with `data`, `execute`, optional `defer` and `autocomplete`
- Helper provides: `kromer` client, `success()`, `error()`, `warning()`, `reply()` methods
- Deploy commands via `pnpm run deploy-commands`

**3. RCC Chat Bot (`src/chat/`)**
- In-game Minecraft chat bot via ReconnectedChat library
- Commands have `name`, optional `aliases`, and `execute` function
- Optional `PREFIX` environment variable for command prefix
- Uses MiniMessage formatting mode

**4. Kromer WebSocket (`src/kromerWs/`)**
- Listens to Kromer blockchain transactions via `HATransactions` (high-availability stream)
- All transactions: broadcasts to Discord webhook + in-game player notifications
- Transactions TO Krawlet address: processes via wallet listeners (shop verification, deletion, etc.)
- Auto-refunds invalid operations with `error=<message>` or `message=<message>` metadata

### Database (Sequelize + MariaDB)
- Connection: `src/lib/models/database.ts` creates Sequelize instance from `DATABASE_URL`
- Models: Player, Shop, Listing, KnownAddress, Turtle, TurtleStat, Changelog, ApiKey, RequestLog
- Relationships defined in `src/lib/models/index.ts`
- Migrations are JavaScript files in `migrations/` directory

### API Authentication System
- API keys have format `kraw_*` and are SHA-256 hashed before storage
- Tiered system: anonymous, free, premium, enterprise (different rate limits per tier)
- `optionalApiKeyAuth` middleware: allows both anonymous and authenticated requests
- `requireApiKey` middleware: enforces authentication
- Quick codes allow in-game redemption of API keys via chat commands

### Transaction Processing Flow
1. `HATransactions` receives transaction from Kromer WebSocket
2. `parseTransactionData()` extracts metadata (detects refunds, errors, messages, etc.)
3. Handlers send formatted data to Discord webhook and in-game notifications
4. If transaction is TO Krawlet address: wallet listeners process operation type
5. Invalid operations are auto-refunded with error/message in transaction metadata

## Key Patterns

### V1 API Response Format
Middleware adds helper methods to response object:
```typescript
res.success(data)              // Returns: { ok: true, data: ... }
res.error(code, message, 401)  // Returns: { ok: false, error: { code, message }, status: 401 }
```

### Discord Command Pattern
```typescript
export const CommandName: DiscordCommand = {
  data: new SlashCommandBuilder()
    .setName('name')
    .setDescription('Description'),
  defer: true,  // Optional: defer reply for long-running operations
  async execute(interaction, helper) {
    // Use helper.success(), helper.error(), helper.warning(), helper.reply()
    // Access Kromer API via helper.kromer
  },
  async autocomplete(interaction, helper) {
    // Optional: handle autocomplete for options
  }
}
```

### RCC Chat Command Pattern
```typescript
export default {
  name: 'commandname',
  aliases: ['alias1', 'alias2'],  // Optional
  async execute(cmd) {
    // cmd.user has Minecraft player info
    // cmd.args array of command arguments
    // Use rcc.tell() to send messages
  }
}
```

### Wallet Listener Pattern
Wallet listeners process transactions sent TO Krawlet and return:
```typescript
{ success: boolean, message: string, ignore?: boolean }
```
- Krawlet auto-refunds sender with the message unless `ignore: true`
- `ignore: true` means transaction was processed successfully (no refund needed)

## Admin Dashboard

The admin dashboard provides a comprehensive web interface for managing API keys and monitoring usage at `/admin`.

**Setup:**
1. Set `ADMIN_PASSWORD` in `.env` to enable the dashboard
2. Navigate to `http://localhost:3000/admin` (or your configured PORT)
3. Login with the password set in `ADMIN_PASSWORD`

**Features:**
- **Overview Statistics**: Total keys, requests, blocked requests, most active key
- **Charts**: 7-day request trends (line chart) and requests by tier (doughnut chart) using Chart.js
- **API Key Management**:
  - View all keys with filtering by tier, status, and search
  - Create new API keys directly from the dashboard
  - View detailed key information with recent activity
  - Enable/disable keys
  - Delete keys (with confirmation)
- **Request Logs**: Pagination, filtering, and search with color-coded blocked requests
- **Export Functionality**: Export API keys and request logs to CSV
- **Real-time Updates**: Auto-refreshes stats and charts every 30 seconds

The dashboard is located at `src/express/admin/index.ts` and uses a single-file HTML/CSS/JS design with Chart.js loaded via CDN - no build step required.

## Environment Variables
Required (see `.env` file):
- `DATABASE_URL` - MariaDB connection string
- `DISCORD_TOKEN` - Discord bot token
- `CHAT_LICENSE` - ReconnectedChat license key
- `KRAWLET_PKEY` - Krawlet wallet private key for transaction operations
- `PORT` - Express server port (default: 3000)
- `PREFIX` - Optional command prefix for RCC chat commands
- `ADMIN_PASSWORD` - Optional password to enable admin dashboard at `/admin`

## Important Implementation Details

- The `kromer` package (imported from `src/lib/kromer.ts`) is a singleton KromerApi client
- Player notifications are per-player configurable: 'all', 'self', or 'none' (see `playerManager.getNotifiedPlayers()`)
- Shop sync validates item listings against actual Kromer blockchain data
- Transaction metadata entries with names in `STRIPPED_META_ENTRIES` are hidden from Discord messages
- Discord embeds use standard footer via `getStandardFooter()` utility
- Request logs track all API usage including blocks for rate limiting and invalid keys
