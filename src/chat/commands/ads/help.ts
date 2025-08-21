import {Command} from "../../../lib/types";
import {ChatboxCommand} from "reconnectedchat";

const command: Command = {
    name: "help",
    description: "View help for advertisement commands",
    usage: "ads help",
    execute: async (cmd: ChatboxCommand) => {

    }
};

export default command;
