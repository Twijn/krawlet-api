import { TransactionData } from '#lib/formatTransaction';
import { TransactionWithMeta } from 'kromer';

export type Handler = (transaction: TransactionWithMeta, data: TransactionData) => void;
