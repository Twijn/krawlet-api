import {Command} from "../../../lib/types";
import {ChatboxCommand} from "reconnectedchat";
import {rcc} from "../../index";

import help from "./help";

const subcommands: Record<string, Command> = {
    help,
};

const command: Command = {
    name: "ads",
    aliases: ["ad", "advertise", "advertisement", "advertisements"],
    description: "All commands related to advertisements",
    usage: "ads help",
    execute: async (cmd: ChatboxCommand) => {
        if (cmd.user.uuid !== "d98440d6-5117-4ac8-bd50-70b086101e3e") {
            rcc.tell(cmd.user, "<red>You are not allowed to use this command!</red>").catch(console.error);
            return;
        }

        if (cmd.args.length === 0) {
            rcc.tell(cmd.user, "<blue>Ads Information:</blue>\n" +
                "")
                .catch(console.error);
            return;
        }

        const command = subcommands[cmd.args[0]];
        if (command) {
            command.execute({
                ...cmd,
                args: cmd.args.slice(1),
            }).catch(console.error);
        } else {
            rcc.tell(cmd.user, "<red>Invalid subcommand!</red>").catch(console.error);
        }
    }
};

export default command;
