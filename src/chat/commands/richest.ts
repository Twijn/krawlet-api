import {Command} from "../../lib/types";
import {ChatboxCommand} from "reconnectedchat";
import kromer from "../../lib/kromer";
import {rcc} from "../index";
import playerManager from "../../lib/managers/playerManager";

const limit = 5;

const command: Command = {
    name: "richest",
    aliases: ["rich", "baltop"],
    execute: async (cmd: ChatboxCommand) => {
        let page: number = 1;

        if (cmd.args.length > 0) {
            page = parseInt(cmd.args[0]);
            if (isNaN(page)) {
                rcc.tell(cmd.user, "<red>Invalid page number!</red>").catch(console.error);
                return;
            }
        }

        const offset = (page - 1) * limit;

        const response = await kromer.getRichAddresses({
            limit, offset,
        });

        let message = `<gray>Showing top <white>Kromer</white> addresses</gray>`;

        for (let i = 0; i < response.addresses.length; i++) {
            const addr = response.addresses[i];
            const player = playerManager.getPlayerFromAddress(addr.address);
            const paddedNum = (i + offset + 1).toString().padStart(2, "0");
            if (player) {
                message += `\n<gray>${paddedNum}.</gray> <hover:show_text:'<gray>${addr.address}'>${player.minecraftName}</hover><gray>:</gray> ${addr.balance} <gray>KRO</gray>`;
            } else {
                message += `\n<gray>${paddedNum}.</gray> ${addr.address}<gray>:</gray> ${addr.balance} <gray>KRO</gray>`;
            }
        }

        message += `\n<gray>Page</gray> ${page} <gray>/</gray> ${Math.ceil(response.total / limit)}`;

        rcc.tell(cmd.user, message).catch(console.error);
        rcc.tell(cmd.user, "[View on Kromer.club](https://www.kromer.club/addresses/rich)", undefined, "markdown").catch(console.error);
    }
};

export default command;
