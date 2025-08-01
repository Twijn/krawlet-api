import {Command} from "../../lib/types";
import {ChatboxCommand} from "reconnectedchat";
import kromer from "../../lib/kromer";
import {rcc} from "../index";

const limit = 20;

const command: Command = {
    name: "names",
    description: "Shows registered names on Kromer",
    usage: "names [page]",
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

        const response = await kromer.getNames({
            limit, offset,
        });

        let message = `<gray>Registered names:</gray>\n`;

        message += response.names
            .map(x => `<hover:show_text:'<gray>${x.owner}'>${x.name}.kro</hover>`)
            .join(", ");

        message += `\n<gray>Page</gray> ${page}<gray>/</gray>${Math.ceil(response.total / limit)}`;

        rcc.tell(cmd.user, message).catch(console.error);
    }
};

export default command;
