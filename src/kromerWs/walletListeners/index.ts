import { TransactionWithMeta } from 'kromer';
import deleteShop from './deleteShop';
import shopVerification from './shopVerification';

export type ListenerResult = {
  success?: boolean;
  message?: string;
  ignore?: boolean;
};

export type Listener = (
  transaction: TransactionWithMeta & { from: string },
) => Promise<ListenerResult>;

export default [deleteShop, shopVerification] as Listener[];
