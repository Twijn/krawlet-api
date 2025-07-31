import {Client} from "reconnectedchat";

import commands from "./commands";

export const rcc = new Client(process.env.CHAT_LICENSE!, {
    defaultName: "&9Krawlet",
    defaultFormattingMode: "minimessage",
});

rcc.on("command", async cmd => {
    const command = commands.find(c =>
        c.name === cmd.command.toLowerCase() ||
        (
            c.aliases && c.aliases.includes(cmd.command.toLowerCase())
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

rcc.on("ready", () => {
    console.log("Connected to RCC chat!");
});

rcc.connect();
