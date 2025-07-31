import {ChatboxCommand} from "reconnectedchat";

export type Command = {
    name: string;
    aliases?: string[];
    execute: (cmd: ChatboxCommand) => Promise<void>;
}
