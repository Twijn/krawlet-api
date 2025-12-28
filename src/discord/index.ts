// Require the necessary discord.js classes
import { Client, Events, GatewayIntentBits, Interaction, MessageFlagsBitField } from 'discord.js';
import { commands } from './commands';
import {
  createInteractionHelper,
  createAutocompleteHelper,
} from './commands/helpers/DiscordCommand';
import { APIError } from 'kromer';

const DISCORD_TOKEN = process.env.DISCORD_TOKEN!;

// Helper function to check if an error is a Kromer APIError
function isAPIError(error: any): error is APIError {
  return (
    error && typeof error === 'object' && error.ok === false && typeof error.error === 'string'
  );
}

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  console.log(`Loaded ${commands.length} commands: ${commands.map((x) => x.data.name).join(', ')}`);
});

// Handle interactions (both commands and autocomplete)
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  // Handle autocomplete interactions
  if (interaction.isAutocomplete()) {
    const command = commands.find((cmd) => cmd.data.name === interaction.commandName);

    if (!command || !command.autocomplete) {
      return;
    }

    try {
      const helper = createAutocompleteHelper(interaction);
      await command.autocomplete(interaction, helper);
    } catch (error) {
      console.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
    }
    return;
  }

  // Handle slash command interactions
  if (!interaction.isChatInputCommand()) return;

  const command = commands.find((cmd) => cmd.data.name === interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    console.log(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);

    // Defer the reply if the command specifies it should be deferred
    if (command.defer) {
      await interaction.deferReply({
        flags: [MessageFlagsBitField.Flags.Ephemeral],
      });
    }

    // Create the interaction helper with utilities
    const helper = createInteractionHelper(interaction);

    // Execute the command
    await command.execute(interaction, helper);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);

    let errorMessage = 'There was an error while executing this command!';

    // Check if this is a Kromer API error and provide a more specific message
    if (isAPIError(error)) {
      errorMessage = error.message || `API Error: ${error.error}`;
    }

    try {
      // Use the helper's error method if available, otherwise fall back to basic reply
      if (interaction.replied || interaction.deferred) {
        if (isAPIError(error)) {
          const helper = createInteractionHelper(interaction);
          await helper.error(errorMessage);
        } else {
          await interaction.editReply({ content: errorMessage });
        }
      } else {
        if (isAPIError(error)) {
          const helper = createInteractionHelper(interaction);
          await helper.error(errorMessage);
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      }
    } catch (replyError) {
      console.error('Error sending error message:', replyError);
    }
  }
});

// Log in to Discord with your client's token
client.login(DISCORD_TOKEN);
