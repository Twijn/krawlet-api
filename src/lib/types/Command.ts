import {ChatboxCommand} from "reconnectedchat";

export type Command = {
    name: string;
    aliases?: string[];
    description: string;
    usage: string;
    execute: (cmd: ChatboxCommand) => Promise<void>;
}
