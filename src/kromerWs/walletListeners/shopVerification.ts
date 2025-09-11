import { Listener, ListenerResult } from './index';
import { TransactionWithMeta } from 'kromer';
import { updateShopAddress } from '../../lib/models';
import playerManager from '../../lib/managers/playerManager';

export const extractMetaname = (transaction: TransactionWithMeta, name: string): string | null => {
  return (
    transaction.meta?.entries?.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
      ?.value ?? null
  );
};

const listener: Listener = async (transaction): Promise<ListenerResult> => {
  const shopName = extractMetaname(transaction, 'shop_name');
  const shopDescription = extractMetaname(transaction, 'shop_description');

  if (shopName || shopDescription) {
    if (!shopName) {
      return { success: false, message: "You must provide a 'shop_name'" };
    } else if (!shopDescription) {
      return { success: false, message: "You must provide a 'shop_description'" };
    } else if (playerManager.getPlayerFromAddress(transaction.from)) {
      return {
        success: false,
        message: "You can't assign a shop to your ReconnectedCC address! (Make a new wallet!)",
      };
    }
    try {
      const newAddress = await updateShopAddress(transaction.from, shopName, shopDescription);
      return {
        success: true,
        message: `Shop address updated successfully;address=${newAddress.address};name=${shopName};description=${shopDescription}`,
      };
    } catch (e) {
      console.error(e);
      return { success: false, message: (e as Error)?.message ?? 'Error updating shop address' };
    }
  }
  return { ignore: true };
};

export default listener;
