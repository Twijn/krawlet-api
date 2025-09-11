import { Listener, ListenerResult } from './index';
import { deleteShopAddress } from '../../lib/models';

const listener: Listener = async (transaction): Promise<ListenerResult> => {
  const metadata = (transaction.metadata ?? '').toLowerCase();
  if (metadata.includes('shop_delete')) {
    try {
      await deleteShopAddress(transaction.from);
      return {
        success: true,
        message: `Shop listing deleted successfully;address=${transaction.from}`,
      };
    } catch (e) {
      console.error(e);
      return { success: false, message: (e as Error)?.message ?? 'Error updating shop address' };
    }
  }
  return { ignore: true };
};

export default listener;
