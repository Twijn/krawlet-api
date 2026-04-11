export type TransferPayload = {
  to: string;
  itemName?: string;
  quantity?: number;
};

export function isTransferPayload(obj: any): obj is TransferPayload {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.to === 'string' &&
    (!obj.itemName || typeof obj.itemName === 'string') &&
    (!obj.quantity || typeof obj.quantity === 'number')
  );
}
