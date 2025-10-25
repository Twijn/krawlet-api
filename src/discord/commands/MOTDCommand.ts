import { codeBlock, CommandInteraction, SlashCommandBuilder } from 'discord.js';
import { DiscordCommand, InteractionHelper } from './helpers/DiscordCommand';

export default class MOTDCommand implements DiscordCommand {
  data = new SlashCommandBuilder()
    .setName('motd')
    .setDescription('Get the current Message of the Day (MOTD) for the server.');

  defer = true;

  execute = async (interaction: CommandInteraction, helper: InteractionHelper): Promise<void> => {
    const motd = await helper.kromer.getMOTD();

    let timestamp: Date | undefined = undefined;

    if (motd.motd_set) {
      timestamp = new Date(motd.motd_set);
    }

    helper
      .reply(codeBlock(motd.motd), 'Message of the Day', {
        timestamp: timestamp?.toISOString(),
        footer: {
          text: `${motd.package.name} v${motd.package.version}`,
        },
      })
      .catch(console.error);
  };
}
