import {Command} from "../../lib/types";
import {ChatboxCommand} from "reconnectedchat";
import kromer from "../../lib/kromer";
import {rcc} from "../index";
import playerManager from "../../lib/managers/playerManager";
import {TransactionsResponse} from "kromer";
import {Player} from "../../lib/models";
import formatTransaction from "../../lib/formatTransaction";

const limit = 6;

const command: Command = {
    name: "transactions",
    aliases: ["transaction"],
    description: "Shows recent transactions",
    usage: "transactions [[page]/all [page]]",
    execute: async (cmd: ChatboxCommand) => {
        let page: number = 1;

        let showAll = false;
        if (cmd.args.length > 0 && cmd.args[0].toLowerCase() === "all") {
            cmd.args.shift();
            showAll = true;
        }

        if (cmd.args.length > 0) {
            page = parseInt(cmd.args[cmd.args.length - 1]);
            if (isNaN(page)) {
                rcc.tell(cmd.user, "<red>Invalid page number!</red>").catch(console.error);
                return;
            }
        }

        const offset = (page - 1) * limit;

        let response: TransactionsResponse;
        let player: Player|null = null;

        if (showAll) {
            response = await kromer.transactions.getLatest({
                limit, offset,
            });
        } else {
            player = await playerManager.getPlayerFromUser(cmd.user);
            if (!player) {
                rcc.tell(cmd.user, "<red>We couldn't retrieve your player (REPORT THIS!)!</red>").catch(console.error);
                return;
            }

            response = await kromer.addresses.getTransactions(player.kromerAddress, {
                limit, offset,
            })
        }

        let message = `<gray>Recent transactions:</gray>`;

        response.transactions.forEach(transaction => {
            message += "\n" + formatTransaction(transaction);
        });

        message += `\n<gray>Page</gray> ${page} <gray>/</gray> ${Math.ceil(response.total / limit)}`;

        rcc.tell(cmd.user, message).catch(console.error);
        rcc.tell(cmd.user, `[View on Kromer.club](https://www.kromer.club/${player ? `addresses/${player.kromerAddress}/transactions` : "transactions"})`, undefined, "markdown").catch(console.error);
    }
};

export default command;

