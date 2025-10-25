import { REST, Routes } from 'discord.js';
import { commands } from './commands';
import dotenv from 'dotenv';

dotenv.config();

// Set a dummy DATABASE_URL for command deployment if not present
// This prevents Sequelize initialization errors when just deploying commands
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'mysql://dummy:dummy@localhost:3306/dummy';
}

// Set a flag to indicate we're deploying commands, not running the app
process.env.DEPLOYING_COMMANDS = 'true';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;

if (!DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN is required in environment variables');
}

if (!CLIENT_ID) {
  throw new Error('DISCORD_CLIENT_ID is required in environment variables');
}

async function deployCommands() {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    // Construct and prepare an instance of the REST module
    const rest = new REST().setToken(DISCORD_TOKEN);

    // Convert command objects to JSON for the API
    const commandData = commands.map((command) => command.data.toJSON());

    let data: any;

    // Deploy commands globally (takes up to 1 hour to propagate)
    console.log('Deploying commands globally...');
    data = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandData });

    console.log(`Successfully refreshed ${(data as any[]).length} application (/) commands.`);

    // Log the deployed commands
    console.log('Deployed commands:');
    commands.forEach((command) => {
      console.log(`  - /${command.data.name}: ${command.data.description}`);
    });

    // Exit cleanly after deployment
    process.exit(0);
  } catch (error) {
    console.error('Error deploying commands:', error);
    process.exit(1);
  }
}

// Run the deployment
deployCommands();
