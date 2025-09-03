import {Command, PlayerAddressResponse} from "../../lib/types";
import {ChatboxCommand, User} from "reconnectedchat";
import {rcc} from "../index";
import {getByName, getByUUID} from "../../lib/playerAddresses";
import kromer from "../../lib/kromer";

const command: Command = {
    name: "meow",
    description: "Meow :)",
    usage: "meow",
    execute: async (cmd: ChatboxCommand) => {
        rcc.tell(cmd.user, "Meow :cat: :3").catch(console.error);
    }
};

export default command;
