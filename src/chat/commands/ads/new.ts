import {Command} from "../../../lib/types";
import {ChatboxCommand} from "reconnectedchat";

const command: Command = {
    name: "new",
    description: "Create a new advertisement",
    usage: "ads new <ad content>",
    execute: async (cmd: ChatboxCommand) => {

    }
};

export default command;
