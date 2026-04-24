import {
  RawTransfer,
  RawTransferNotification,
  Transfer,
  TransferNotification,
  TransferNotificationType,
  findEntityById,
  EstorageEntityLink,
} from './models';
import { Op } from 'sequelize';

export type CreateTransferNotificationParams = {
  transferId: string;
  message: string;
  type?: TransferNotificationType;
  senderEntityId?: string;
};

function normalizeMessage(message: string): string {
  return message.trim();
}

async function sendTransferNotificationChat(
  transferId: string,
  toEntityId: string,
  notificationType: TransferNotificationType,
  message: string,
): Promise<void> {
  try {
    // Lazy import to avoid circular dependencies
    const { rcc } = await import('../chat');

    // Get entity and its player link
    const entity = await findEntityById(toEntityId);
    if (!entity) {
      return;
    }

    // Find the primary player link for this entity
    const playerLink = await EstorageEntityLink.findOne({
      where: {
        entityId: toEntityId,
        linkType: 'player_uuid',
      },
      order: [['isPrimary', 'DESC']],
    });

    if (!playerLink) {
      return;
    }

    const playerUuid = playerLink.linkValue;
    const player = rcc.players?.find((p: { uuid: string }) => p.uuid === playerUuid);
    if (!player) {
      return;
    }

    // Determine message color and closing tag based on notification type
    let colorTag = '<blue>';
    let closeTag = '</blue>';
    if (notificationType === 'error') {
      colorTag = '<red>';
      closeTag = '</red>';
    } else if (notificationType === 'success') {
      colorTag = '<green>';
      closeTag = '</green>';
    }

    const chatMessage = `${colorTag}Transfer notification: ${message}${closeTag}`;

    rcc.tell(playerUuid, chatMessage).catch((err: unknown) => {
      console.warn(`Failed to send transfer notification chat message to ${playerUuid}:`, err);
    });
  } catch (err) {
    // Silently fail - chat notification is not critical
    console.warn('Failed to send transfer notification chat:', err);
  }
}

export async function createTransferNotification(
  params: CreateTransferNotificationParams,
): Promise<RawTransferNotification> {
  const normalizedMessage = normalizeMessage(params.message);

  if (!normalizedMessage) {
    throw new Error('Notification message cannot be empty');
  }

  if (normalizedMessage.length > 512) {
    throw new Error('Notification message cannot exceed 512 characters');
  }

  const notification = await TransferNotification.create({
    transferId: params.transferId,
    senderEntityId: params.senderEntityId,
    type: params.type ?? 'info',
    message: normalizedMessage,
  });

  // Send chat notification asynchronously (don't await)
  const transfer = await Transfer.findOne({ where: { id: params.transferId } });
  if (transfer) {
    void sendTransferNotificationChat(
      params.transferId,
      transfer.toEntityId,
      params.type ?? 'info',
      normalizedMessage,
    );
  }

  return notification.raw();
}

export async function attachTransferNotifications(
  transfers: RawTransfer[],
  includeNotifications: boolean,
): Promise<RawTransfer[]> {
  if (!includeNotifications || transfers.length === 0) {
    return transfers;
  }

  const ids = transfers.map((transfer) => transfer.id);
  const notifications = await TransferNotification.findAll({
    where: { transferId: { [Op.in]: ids } },
    order: [
      ['transferId', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });

  const byTransferId = new Map<string, RawTransferNotification[]>();
  for (const notification of notifications) {
    const raw = notification.raw();
    const existing = byTransferId.get(raw.transferId);
    if (existing) {
      existing.push(raw);
    } else {
      byTransferId.set(raw.transferId, [raw]);
    }
  }

  return transfers.map((transfer) => ({
    ...transfer,
    notifications: byTransferId.get(transfer.id) ?? [],
  }));
}
