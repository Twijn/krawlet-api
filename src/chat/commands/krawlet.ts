import { Command } from '../../lib/types';
import { ChatboxCommand } from 'reconnectedchat';

import commands from './index';
import { rcc } from '../index';
import playerManager from '../../lib/managers/playerManager';

const PREFIX = '\\' + (process.env.PREFIX ?? '');

const NOTIFICATION_SETTINGS = ['all', 'self', 'none'];

const command: Command = {
  name: 'krawlet',
  aliases: ['kromer', 'kro'],
  description: 'Shows this menu!',
  usage: 'krawlet [notif [all/self/none]]',
  execute: async (cmd: ChatboxCommand) => {
    if (cmd.args.length > 0) {
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
