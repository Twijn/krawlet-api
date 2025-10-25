import AddressCommand from './AddressCommand';
import BalanceCommand from './BalanceCommand';
import BaltopCommand from './BaltopCommand';
import { DiscordCommand } from './helpers/DiscordCommand';
import MOTDCommand from './MOTDCommand';
import NamesCommand from './NamesCommand';
import PlayerCommand from './PlayerCommand';
import SupplyCommand from './SupplyCommand';
import TransactionsCommand from './TransactionsCommand';

export const commands: DiscordCommand[] = [
  new AddressCommand(),
  new BalanceCommand(),
  new BaltopCommand(),
  new MOTDCommand(),
  new NamesCommand(),
  new PlayerCommand(),
  new SupplyCommand(),
  new TransactionsCommand(),
];
