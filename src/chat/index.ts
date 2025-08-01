import {Client} from "reconnectedchat";

import commands from "./commands";
import playerManager from "../lib/managers/playerManager";

const PREFIX = process.env.PREFIX ?? "";

export const rcc = new Client(process.env.CHAT_LICENSE!, {
    defaultName: "&9Krawlet",
    defaultFormattingMode: "minimessage",
});

rcc.on("command", async cmd => {
    let commandName = cmd.command.toLowerCase();

    if (PREFIX.length > 0) {
        if (!commandName.startsWith(PREFIX)) return;
        commandName = commandName.replace(PREFIX, "");
    }

    const command = commands.find(c =>
        c.name === commandName ||
        (
            c.aliases && c.aliases.includes(commandName)
        )
    );

    if (!command) return;

    try {
        console.log(`Executing command ${command.name} from player ${cmd.user.name}`);
        await command.execute(cmd);
    } catch(err) {
        console.error(`Error executing command ${command.name}`);
        console.error(err);
    }
});

rcc.on("join", async join => {
    await playerManager.getPlayerFromUser(join.user);
});

rcc.on("ready", () => {
    console.log("Connected to RCC chat!");
});

rcc.connect();
