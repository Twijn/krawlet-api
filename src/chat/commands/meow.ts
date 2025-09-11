import { Command } from '../../lib/types';
import { ChatboxCommand } from 'reconnectedchat';
import { rcc } from '../index';

const command: Command = {
  name: 'meow',
  description: 'Meow :)',
  usage: 'meow',
  execute: async (cmd: ChatboxCommand) => {
    rcc.tell(cmd.user, 'Meow :cat: :3').catch(console.error);
  },
};

export default command;
