# GitHub Secrets Setup Guide

## Required Environment Variables for Deploy Commands Action

You need to set up the following secrets in your GitHub repository:

### Required Secrets:

1. **DISCORD_CLIENT_ID**
   - Your Discord application's Client ID
   - Found in Discord Developer Portal > Your App > General Information > Application ID

2. **DISCORD_TOKEN**
   - Your Discord bot's token
   - Found in Discord Developer Portal > Your App > Bot > Token
   - ⚠️ **IMPORTANT**: Never share this token publicly!

## How to Add Secrets in GitHub:

### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository: `https://github.com/Twijn/krawlet-api`
2. Click on the **"Settings"** tab (at the top of the repo)

### Step 2: Access Secrets

1. In the left sidebar, scroll down to **"Security"** section
2. Click on **"Secrets and variables"**
3. Click on **"Actions"**

### Step 3: Add Repository Secrets

1. Click the **"New repository secret"** button
2. Add each secret:

   **Secret 1:**
   - Name: `DISCORD_CLIENT_ID`
   - Value: Your Discord application's Client ID (e.g., `1234567890123456789`)

   **Secret 2:**
   - Name: `DISCORD_TOKEN`
   - Value: Your Discord bot token (e.g., `your-discord-bot-token-here`)

### Step 4: Verify Setup

- After adding both secrets, you should see them listed in the "Repository secrets" section
- The values will be hidden (showing only the names)

## How the Action Works:

### Triggers:

- **Automatic**: Runs when you push changes to the `main` branch that affect:
  - Any files in `src/discord/commands/`
  - The `src/discord/putCommands.ts` file
  - The workflow file itself
- **Manual**: You can also trigger it manually:
  1. Go to **Actions** tab in your GitHub repo
  2. Click on **"Deploy Discord Commands"** workflow
  3. Click **"Run workflow"** button
  4. Click **"Run workflow"** to confirm

### What it Does:

1. Checks out your code
2. Sets up Node.js and pnpm
3. Installs dependencies
4. Builds the TypeScript project
5. Runs `pnpm deploy-commands` to update Discord slash commands

### Monitoring:

- View workflow runs in the **Actions** tab of your repository
- Each run shows logs and status
- Failed runs will show error details to help troubleshoot

## Security Notes:

- Never commit Discord tokens to code
- Repository secrets are encrypted and only accessible to GitHub Actions
- Only repository collaborators with write access can view/edit secrets
- Secrets are not exposed in pull requests from forks

## Troubleshooting:

If the action fails, check:

1. Both secrets are set correctly in GitHub
2. Discord bot has necessary permissions
3. Discord application is properly configured
4. Check the Actions logs for specific error messages
