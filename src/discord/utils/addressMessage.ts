import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  codeBlock,
  EmbedBuilder,
  MessageFlagsBitField,
} from 'discord.js';
import kromer from '../../lib/kromer';
import { formatKromerBalance } from '../../lib/formatKromer';
import createTextTable from '../textTable';
import { parseTransactionData } from '../../lib/formatTransaction';
import { addStandardFooter } from './embedFooter';

export async function sendAddressMessage(
  title: string,
  addressString: string,
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const address = await kromer.addresses.get(addressString, { fetchNames: true });

  // Get names owned by this address
  const namesResponse = await kromer.addresses.getNames(addressString, { limit: 10 });
  const namesList = namesResponse.names.map((n) => `${n.name}.kro`).join(', ') || 'None';

  // Format the address information
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0x208eb8) // #208eb8
    .addFields(
      { name: 'Balance', value: codeBlock(formatKromerBalance(address.balance)), inline: true },
      { name: 'Total In', value: codeBlock(formatKromerBalance(address.totalin)), inline: true },
      {
        name: 'Total Out',
        value: codeBlock(formatKromerBalance(address.totalout)),
        inline: true,
      },
      {
        name: 'First Seen',
        value: `<t:${Math.floor(address.firstseen.getTime() / 1000)}:R>`,
        inline: true,
      },
      {
        name: 'Names Owned',
        value: namesList.length > 100 ? namesList.substring(0, 97) + '...' : namesList,
        inline: true,
      },
    );

  const transactionsResponse = await kromer.addresses.getTransactions(addressString, {
    limit: 10,
  });
  if (transactionsResponse.transactions.length > 0) {
    embed.addFields({
      name: 'Recent Transactions',
      value: createTextTable(
        ['ID', 'From', 'To', 'Amt'],
        transactionsResponse.transactions.map((tx) => {
          const data = parseTransactionData(tx);

          return [`#${tx.id}`, data.from, data.to, formatKromerBalance(tx.value)];
        }),
        ['right', 'left', 'left', 'right'],
      ),
      inline: false,
    });
  } else {
    embed.addFields({
      name: 'Recent Transactions',
      value: 'No transactions found.',
      inline: false,
    });
  }

  // Add footer with version info
  addStandardFooter(embed);

  // Create buttons for additional actions
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('View on Kromer.club')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://kromer.club/addresses/${address.address}`),
    new ButtonBuilder()
      .setLabel('View Transactions')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://kromer.club/addresses/${address.address}/transactions`),
  );

  // Send the response with embed and buttons
  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({ embeds: [embed], components: [buttons] });
  } else {
    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      flags: [MessageFlagsBitField.Flags.Ephemeral],
    });
  }
}
