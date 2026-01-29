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
      // Generate a quick code for the existing key
      const quickCode = await existingKey.setQuickCode();
      rcc
        .tell(
          cmd.user,
          `<yellow>You already have an API key!</yellow> Here's a quick code to retrieve it:<br><gold><bold>${quickCode}</bold></gold> <gray>(expires in 15 min)</gray>`,
        )
        .catch(console.error);
      rcc
        .tell(
          cmd.user,
          `Import to Krawlet: [Click Here](https://www.kromer.club/settings/advanced#${quickCode})`,
          undefined,
          'markdown',
        )
        .catch(console.error);
      rcc
        .tell(cmd.user, `<red>Note:</red> <gray>Redeeming will regenerate your API key!</gray>`)
        .catch(console.error);
      return;
    }

    // Generate a new API key
    const rawKey = ApiKey.generateKey();
    const hashedKey = ApiKey.hashKey(rawKey);

    const newKey = await ApiKey.create({
      key: hashedKey,
      name: `${mcName}'s API Key`,
      tier: 'free',
      rateLimit: 1000,
      isActive: true,
      mcUuid: uuid,
      mcName: mcName,
    });

    // Generate a quick code for immediate retrieval
    const quickCode = await newKey.setQuickCode();

    rcc
      .tell(cmd.user, `<green>API Key generated!</green> Use this quick code to retrieve it:`)
      .catch(console.error);
    rcc
      .tell(cmd.user, `<gold><bold>${quickCode}</bold></gold> <gray>(expires in 15 min)</gray>`)
      .catch(console.error);
    rcc
      .tell(
        cmd.user,
        `Import to Krawlet: [Click Here](https://www.kromer.club/settings/advanced#${quickCode})`,
        undefined,
        'markdown',
      )
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

    // Generate a quick code instead of returning raw key
    const quickCode = await existingKey.setQuickCode();

    rcc
      .tell(
        cmd.user,
        `<green>Ready to regenerate!</green> Use this quick code:<br><gold><bold>${quickCode}</bold></gold> <gray>(expires in 15 min)</gray>`,
      )
      .catch(console.error);
    rcc
      .tell(
        cmd.user,
        `Import to Krawlet: [Click Here](https://www.kromer.club/settings/advanced#${quickCode})`,
        undefined,
        'markdown',
      )
      .catch(console.error);
    rcc
      .tell(
        cmd.user,
        `<red>Note:</red> <gray>Your old key will be invalidated when you redeem!</gray>`,
      )
      .catch(console.error);
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
