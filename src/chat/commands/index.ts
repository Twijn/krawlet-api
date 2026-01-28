import { Command } from '../../lib/types';
import balance from './balance';
import findshop from './findshop';
import krawlet from './krawlet';
import meow from './meow';
import mini from './mini';
import richest from './richest';
import names from './names';
import transactions from './transactions';

export default [balance, findshop, krawlet, meow, mini, names, richest, transactions] as Command[];
