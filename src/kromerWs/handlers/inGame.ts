import { formatTransactionForChat, TransactionData } from '#lib/formatTransaction';
import playerManager from '#lib/managers/playerManager';
import type { TransactionWithMeta } from 'kromer';
import { rcc } from '../../chat';
import { createLogger } from '#lib/logger';

const log = createLogger('InGameChatHandler');

export async function sendInGameMessage(transaction: TransactionWithMeta, data: TransactionData) {
  if (
    transaction.meta?.entries.some(
      (e) => e.name.toLowerCase() === 'hide' && e.value.toLowerCase() == 'true',
    ) ??
    false
  )
    return;

  let sentNames: string[] = [];

  const formattedTx = await formatTransactionForChat(transaction, data);

  playerManager.getNotifiedPlayers().forEach((player) => {
    const fromSelf = transaction.from === player.kromerAddress;
    const toSelf = transaction.to === player.kromerAddress;
    if (
      player.notifications === 'all' ||
      (player.notifications === 'self' && (fromSelf || toSelf))
    ) {
      rcc
        .tell(player.minecraftName, `<gray>New transaction:</gray>\n ${formattedTx}`)
        .catch(console.error);
      sentNames.push(player.minecraftName);
    }
  });

  if (sentNames.length > 0) {
    log.info(`Sent transaction (${transaction.id}) notifications to ${sentNames.join(', ')}`);
  }
}
