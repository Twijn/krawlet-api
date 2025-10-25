import { SlashCommandBuilder, CommandInteraction, codeBlock } from 'discord.js';
import { DiscordCommand, InteractionHelper } from './helpers/DiscordCommand';
import { formatKromerBalance } from '../../lib/formatKromer';

export default class SupplyCommand implements DiscordCommand {
  data = new SlashCommandBuilder()
    .setName('supply')
    .setDescription('Get the current supply of Kromer.');

  defer = true;

  execute = async (interaction: CommandInteraction, helper: InteractionHelper): Promise<void> => {
    const supply = await helper.kromer.getSupply();
    const serverwelfBalance = (await helper.kromer.addresses.get('serverwelf')).balance;
    const playerSupply = supply - serverwelfBalance;

    helper
      .reply(
        `The current supply of Kromer is \`${formatKromerBalance(playerSupply)}\`.`,
        'Kromer Supply',
        {
          fields: [
            {
              name: 'Player Supply',
              value: `${codeBlock(formatKromerBalance(playerSupply))}`,
              inline: true,
            },
            {
              name: 'Total Supply',
              value: `${codeBlock(formatKromerBalance(supply))}`,
              inline: true,
            },
            {
              name: 'Serverwelf Balance',
              value: `${codeBlock(formatKromerBalance(serverwelfBalance))}`,
              inline: true,
            },
          ],
        },
      )
      .catch(console.error);
  };
}
