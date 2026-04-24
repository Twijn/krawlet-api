export type TransferPayload = {
  to: string;
  itemName?: string;
  itemDisplayName?: string;
  itemNbt?: string;
  memo?: string;
  quantity?: number;
};

export type TransferNotificationType = 'error' | 'info' | 'success';

export type TransferNotificationPayload = {
  type?: TransferNotificationType;
  message: string;
};

export type WsTransferNotificationPayload = TransferNotificationPayload & {
  transferId: string;
};

export function isTransferPayload(obj: any): obj is TransferPayload {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.to === 'string' &&
    (!obj.itemName || typeof obj.itemName === 'string') &&
    (!obj.itemDisplayName || typeof obj.itemDisplayName === 'string') &&
    (!obj.itemNbt || typeof obj.itemNbt === 'string') &&
    (!obj.memo || typeof obj.memo === 'string') &&
    (!obj.quantity || typeof obj.quantity === 'number')
  );
}

export function isTransferNotificationPayload(obj: any): obj is TransferNotificationPayload {
  return (
    obj &&
    typeof obj === 'object' &&
    (obj.type === undefined ||
      obj.type === 'error' ||
      obj.type === 'info' ||
      obj.type === 'success') &&
    typeof obj.message === 'string'
  );
}

export function isWsTransferNotificationPayload(obj: any): obj is WsTransferNotificationPayload {
  const payload = obj as { transferId?: unknown };

  return (
    isTransferNotificationPayload(obj) &&
    typeof payload.transferId === 'string' &&
    payload.transferId.length > 0
  );
}
