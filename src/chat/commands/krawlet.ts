import {Command} from "../../lib/types";
import {ChatboxCommand} from "reconnectedchat";

import commands from "./index";
import {rcc} from "../index";

const PREFIX = "\\" + (process.env.PREFIX ?? "");

const limit = 5;

const command: Command = {
    name: "krawlet",
    aliases: ["kromer", "kro"],
    description: "Shows this menu!",
    usage: "krawlet",
    execute: async (cmd: ChatboxCommand) => {
        let result = `<blue>Krawlet Help:</blue>`;

        for (const command of commands) {
            result += `\n${PREFIX + command.name} <gray>-</gray> ${command.description}`;
            result += `\n     <dark_gray>Usage:</dark_gray> <gray>${PREFIX}${command.usage}</gray>`;
            if (command.aliases) {
                result += `\n     <dark_gray>Aliases: ${command.aliases.join(", ")}</dark_gray>`;
            }
        }

        rcc.tell(cmd.user, result).catch(console.error);
    }
};

export default command;
