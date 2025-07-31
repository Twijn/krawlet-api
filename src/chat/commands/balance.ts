import {Command, PlayerAddressResponse} from "../../lib/types";
import {ChatboxCommand, User} from "reconnectedchat";
import {rcc} from "../index";
import {getByName, getByUUID} from "../../lib/playerAddresses";

const command: Command = {
    name: "balance",
    aliases: ["bal"],
    execute: async (cmd: ChatboxCommand) => {
        if (cmd.args.length === 0) {
            rcc.tell(cmd.user, "<blue>Retrieving your balance!</blue>").catch(console.error);
        } else {
            rcc.tell(cmd.user, `<blue>Retrieving ${cmd.args[0]}'s balance!</blue>`).catch(console.error);
        }

        try {
            let target: User = cmd.user;
            let targetName: string = target.name;
            let result: PlayerAddressResponse|null = null;

            if (cmd.args.length > 0) {
                let user = rcc.players.find(p => p.name.toLowerCase() === cmd.args[0].toLowerCase());
                if (user) {
                    target = user;
                } else {
                    targetName = cmd.args[0];
                    result = await getByName(cmd.args[0]);
                }
            }

            if (!result) {
                targetName = target.name;
                result = await getByUUID(target.uuid);
            }

            let balance = 0;

            result.data.forEach(address => {
                balance += address.balance;
            })

            rcc.tell(
                cmd.user,
                `<gray>Player</gray> ${targetName} <gray>has</gray> ${balance} <gray>KRO</gray>`
            ).catch(console.error);

            if (result.data.length > 0) {
                const { address } = result.data[0];
                rcc.tell(
                    cmd.user,
                    `[View ${address} on Kromer.club](https://www.kromer.club/addresses/${address})`,
                    undefined,
                    "markdown"
                ).catch(console.error);
            }
        } catch(e) {
            rcc.tell(cmd.user, `<red>Failed to get player ${cmd.args[0]}: ${(e as Error)?.message ?? "Internal error"}</red>`).catch(console.error);
            return;
        }
    }
};

export default command;
