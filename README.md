# Krawlet API

Krawlet API is a TypeScript Node.js application that powers API and bot services for the Krist economy system on a Minecraft server.

It combines several subsystems in one app:

- an Express API
- a Discord bot
- an in-game chat bot via ReconnectedChat
- a Kromer WebSocket listener for real-time transaction processing

## Tech stack

- TypeScript
- Node.js
- Express
- Discord.js
- Sequelize + MariaDB
- WebSockets
- `pnpm`

## Project structure

```text
src/
  chat/        In-game Minecraft chat bot
  discord/     Discord bot and slash commands
  express/     REST API and API docs
  kromerWs/    Kromer transaction websocket handlers
  lib/         Shared utilities, models, and helpers
  scripts/     Utility scripts
  index.ts     App entrypoint
migrations/    Sequelize migrations
openapi.yaml   OpenAPI definition
```

## How it starts

The app entrypoint is `src/index.ts`. On startup it:

1. loads environment variables
2. starts the request log retention job
3. initializes the chat bot, Express API, WebSocket listener, and Discord bot

## Requirements

- Node.js
- `pnpm`
- MariaDB-compatible database
- valid credentials for the services you want to run

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create your environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in the required environment variables in `.env`.

   Common variables used by this project include:

   - `DATABASE_URL`
   - `PORT`
   - `RATE_LIMIT_IGNORE_IPS`
   - `REQUEST_LOG_RETENTION_DAYS`
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID` (used for slash command deployment)
   - `KROMER_WEBHOOK`
   - `CHAT_LICENSE`
   - `PREFIX`
   - `KRAWLET_PKEY`

4. Run database migrations:

   ```bash
   pnpm run migrate
   ```

5. Build the project:

   ```bash
   pnpm run build
   ```

6. Start the app:

   ```bash
   pnpm run start
   ```

## Development

### Main commands

```bash
pnpm run dev          # Build and start the app
pnpm run build        # Compile TypeScript to dist/
pnpm run start        # Run the compiled app
pnpm run clean        # Remove dist/
```

### Database migrations

```bash
pnpm run migrate
pnpm run migrate:create -- <name>
pnpm run migrate:undo
```

### Code quality

```bash
pnpm run lint
pnpm run lint:fix
pnpm run format
```

### Utilities

```bash
pnpm run gen-apikey
pnpm run provision-transfer-key
pnpm run apikey-info
pnpm run deploy-commands
```

## API

The Express server provides:

- API routes under `/api/v1`
- API documentation at `/`
- some legacy compatibility routes under `/api` and root-level paths

The repository also includes `openapi.yaml`.

## Architecture notes

### Express API

The Express app handles REST endpoints, API docs, API key authentication, and rate limiting.

### Discord bot

The Discord bot exposes slash commands for economy-related actions and queries.

### Chat bot

The chat bot integrates with Minecraft in-game chat using ReconnectedChat.

### Kromer WebSocket listener

The WebSocket subsystem listens for transaction events and processes wallet-related actions, notifications, and refunds.

## Database

This project uses Sequelize with MariaDB.

- database config is initialized in `src/lib/models/database.ts`
- model relationships are defined in `src/lib/models`
- migrations live in `migrations/`

## Notes

- API keys are stored hashed, not in plaintext.
- Some subsystems depend on external services and valid credentials before startup will work correctly.
- If you change slash commands, redeploy them with `pnpm run deploy-commands`.
    - The `Deploy Discord Commands` workflow can be used to redeploy commands via GitHub Actions. Supply `DISCORD_CLIENT_ID` and `DISCORD_TOKEN` as secrets.
