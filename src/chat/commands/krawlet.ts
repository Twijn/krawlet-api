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
          `<red>You already have an API key!</red> Created: ${existingKey.createdAt.toLocaleDateString()}. Contact admin if lost.`,
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
    rcc.tell(cmd.user, `<gold>${rawKey}</gold>`).catch(console.error);
  } catch (err) {
    console.error('Error generating API key via chatbox:', err);
    rcc
      .tell(cmd.user, `<red>Error generating API key. Try again later.</red>`)
      .catch(console.error);
  }
}

const command: Command = {
  name: 'krawlet',
  aliases: ['kromer', 'kro'],
  description: 'Shows this menu!',
  usage: 'krawlet [notif [all/self/none] | api]',
  execute: async (cmd: ChatboxCommand) => {
    if (cmd.args.length > 0) {
      // Handle API key generation subcommand
      if (['api', 'apikey', 'key'].includes(cmd.args[0].toLowerCase())) {
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
