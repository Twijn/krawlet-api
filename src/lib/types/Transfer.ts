export type TransferPayload = {
  to: string;
  itemName?: string;
  itemDisplayName?: string;
  itemNbt?: string;
  memo?: string;
  quantity?: number;
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
