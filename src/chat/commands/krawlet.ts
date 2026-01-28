import { Command } from '../../lib/types';
import { ChatboxCommand } from 'reconnectedchat';

import commands from './index';
import { rcc } from '../index';
import playerManager from '../../lib/managers/playerManager';
import { ApiKey } from '../../lib/models/apikey.model';

const PREFIX = '\\' + (process.env.PREFIX ?? '');

const NOTIFICATION_SETTINGS = ['all', 'self', 'none'];

async function handleApiKeyGeneration(cmd: ChatboxCommand): Promise<void> {
  const uuid = cmd.user.uuid;
  const mcName = cmd.user.name;

  try {
    // Check if this user already has an API key
    const existingKey = await ApiKey.findOne({
      where: {
        mcUuid: uuid,
      },
    });

    if (existingKey) {
      rcc
        .tell(
          cmd.user,
          `<red>You already have an API key!</red> Created: ${existingKey.createdAt.toLocaleDateString()}. Use <yellow>${PREFIX}krawlet api regen</yellow> to regenerate.`,
        )
        .catch(console.error);
      return;
    }

    // Generate a new API key
    const rawKey = ApiKey.generateKey();
    const hashedKey = ApiKey.hashKey(rawKey);

    await ApiKey.create({
      key: hashedKey,
      name: `${mcName}'s API Key`,
      tier: 'free',
      rateLimit: 1000,
      isActive: true,
      mcUuid: uuid,
      mcName: mcName,
    });

    rcc
      .tell(cmd.user, `<green>API Key generated!</green> <red>SAVE THIS - shown once!</red>`)
      .catch(console.error);
    rcc
      .tell(cmd.user, `<gold><click:copy-to-clipboard:${rawKey}>${rawKey}</gold></click>`)
      .catch(console.error);
  } catch (err) {
    console.error('Error generating API key via chatbox:', err);
    rcc
      .tell(cmd.user, `<red>Error generating API key. Try again later.</red>`)
      .catch(console.error);
  }
}

async function handleApiKeyRegeneration(cmd: ChatboxCommand, confirmed: boolean): Promise<void> {
  const uuid = cmd.user.uuid;
  const mcName = cmd.user.name;

  try {
    // Check if this user has an existing API key
    const existingKey = await ApiKey.findOne({
      where: {
        mcUuid: uuid,
      },
    });

    if (!existingKey) {
      rcc
        .tell(
          cmd.user,
          `<red>You don't have an API key to regenerate!</red> Use <yellow>${PREFIX}krawlet api</yellow> to generate one.`,
        )
        .catch(console.error);
      return;
    }

    if (!confirmed) {
      rcc
        .tell(
          cmd.user,
          `<yellow><bold>Warning:</bold></yellow> Regenerating your API key will <red>invalidate your current key</red>.`,
        )
        .catch(console.error);
      rcc
        .tell(cmd.user, `<gray>Any applications using your old key will stop working.</gray>`)
        .catch(console.error);
      rcc
        .tell(
          cmd.user,
          `<green><click:suggest_command:${PREFIX}krawlet api regen confirm>[Click here]</click></green> or run <yellow>${PREFIX}krawlet api regen confirm</yellow> to proceed.`,
        )
        .catch(console.error);
      return;
    }

    // Generate a new API key
    const rawKey = ApiKey.generateKey();
    const hashedKey = ApiKey.hashKey(rawKey);

    // Update the existing key
    existingKey.key = hashedKey;
    existingKey.mcName = mcName; // Update name in case it changed
    await existingKey.save();

    rcc
      .tell(cmd.user, `<green>API Key regenerated!</green> <red>SAVE THIS - shown once!</red>`)
      .catch(console.error);
    rcc
      .tell(
        cmd.user,
        `<gold><click:copy_to_clipboard:${rawKey}>${rawKey.substring(0, 20)}...</gold> <gray>[copy]</gray></click>`,
      )
      .catch(console.error);
    rcc.tell(cmd.user, `<gray>Your old API key has been invalidated.</gray>`).catch(console.error);
  } catch (err) {
    console.error('Error regenerating API key via chatbox:', err);
    rcc
      .tell(cmd.user, `<red>Error regenerating API key. Try again later.</red>`)
      .catch(console.error);
  }
}

const command: Command = {
  name: 'krawlet',
  aliases: ['kromer', 'kro'],
  description: 'Shows this menu!',
  usage: 'krawlet [notif [all/self/none] | api [regen [confirm]]]',
  execute: async (cmd: ChatboxCommand) => {
    if (cmd.args.length > 0) {
      // Handle API key generation/regeneration subcommand
      if (['api', 'apikey', 'key'].includes(cmd.args[0].toLowerCase())) {
        // Check for regeneration subcommand
        if (cmd.args.length >= 2 && ['regen', 'regenerate'].includes(cmd.args[1].toLowerCase())) {
          const confirmed = cmd.args.length >= 3 && cmd.args[2].toLowerCase() === 'confirm';
          await handleApiKeyRegeneration(cmd, confirmed);
          return;
        }
        await handleApiKeyGeneration(cmd);
        return;
      }

      if (['notif', 'notification', 'notifications'].includes(cmd.args[0].toLowerCase())) {
        let response = `<red>Usage: ${PREFIX}krawlet notif [${NOTIFICATION_SETTINGS.join('/')}]</red>`;

        if (cmd.args.length >= 2) {
          const setting = cmd.args[1].toLowerCase();
          if (NOTIFICATION_SETTINGS.includes(setting)) {
            const player = await playerManager.getPlayerFromUser(cmd.user);
            if (player) {
              player.notifications = setting;
              await player.save();
              response = `<gray>Notification setting set to</gray> ${setting}`;
            } else {
              response = `<red>We couldn't retrieve your player (REPORT THIS!)!</red>`;
            }
          }
        }

        rcc.tell(cmd.user, response).catch(console.error);
        return;
      }
    }

    let result = `<blue>Krawlet Help:</blue>`;

    for (const command of commands) {
      result += `\n${PREFIX + command.name} <gray>-</gray> ${command.description}`;
      result += `\n     <dark_gray>Usage:</dark_gray> <gray>${PREFIX}${command.usage}</gray>`;
      if (command.aliases) {
        result += `\n     <dark_gray>Aliases: ${command.aliases.join(', ')}</dark_gray>`;
      }
    }

    rcc.tell(cmd.user, result).catch(console.error);
  },
};

export default command;
