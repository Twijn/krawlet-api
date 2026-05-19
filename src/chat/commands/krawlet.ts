import { Command } from '../../lib/types';
import { ChatboxCommand } from 'reconnectedchat';

import commands from './index';
import { rcc } from '../index';
import playerManager from '../../lib/managers/playerManager';
import { ApiKey } from '../../lib/models/apikey.model';
import { createLogger } from '../../lib/logger';

const log = createLogger('Chat');

const PREFIX = '\\' + (process.env.PREFIX ?? '');

const NOTIFICATION_SETTINGS = ['all', 'self', 'none'];

async function handleApiKeyGeneration(cmd: ChatboxCommand): Promise<void> {
  const uuid = cmd.user.uuid;
  const mcName = cmd.user.name;

  try {
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
      .tell(cmd.user, `<green>API key created!</green> Use this quick code to retrieve it:`)
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
    log.error('Error generating API key via chatbox:', err);
    rcc
      .tell(cmd.user, `<red>Error generating API key. Try again later.</red>`)
      .catch(console.error);
  }
}

const command: Command = {
  name: 'krawlet',
  aliases: ['kromer', 'kro', 'klog'],
  description: 'Shows this menu!',
  usage: 'krawlet [notif [all/self/none] | optIn | optOut]',
  execute: async (cmd: ChatboxCommand) => {
    if (cmd.args.length > 0) {
      if (['optin', 'optout'].includes(cmd.args[0].toLowerCase())) {
        const player = await playerManager.getPlayerFromUser(cmd.user);

        if (!player) {
          rcc.tell(cmd.user, `<red>We couldn't retrieve your player!</red>`).catch(console.error);
          return;
        }

        const enable = cmd.args[0].toLowerCase() === 'optin';
        player.transferNotificationsEnabled = enable;
        await player.save();

        const response = enable
          ? '<gray>Transfer confirmations enabled.</gray>'
          : '<gray>Transfer confirmations disabled.</gray>';

        rcc.tell(cmd.user, response).catch(console.error);
        return;
      }

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

    if (cmd.command.toLowerCase().includes('klog')) {
      // Print klog-specific help
      const response =
        `<blue>Klog Commands:</blue>` +
        `\n <gray>${PREFIX}klog <optIn/optOut></gray> <dark_gray>-</dark_gray> Enable or disable transfer notifications` +
        `\n <gray>${PREFIX}klog api</gray> <dark_gray>-</dark_gray> Generate a new API key for Krawlet/Klog` +
        `\n\n<gray>To get started with Klog, visit a Krawlet kiosk at <white>/warp mall</white> or at <white>OmniStore</white>.</gray>` +
        `\n<gray>Then, download and run <white>https://krawlet.cc/klog-cli.lua</white> to start sending items!</gray>`;

      rcc.tell(cmd.user, response).catch(console.error);
      return;
    }

    rcc.tell(cmd.user, result).catch(console.error);
  },
};

export default command;
