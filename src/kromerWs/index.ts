import kromer from "../lib/kromer";
import playerManager from "../lib/managers/playerManager";
import {rcc} from "../chat";

import {hook} from "../lib/webhook";
import {Transaction} from "kromer";

function transactionUrl(transaction: Transaction) {
    return `[#${transaction.id}](https://kromer.club/transactions/${transaction.id})`;
}

function addressUrl(address: string, label?: string) {
    if (!label) {
        label = address;
    } else if (label !== address) {
        label += ` (${address})`;
    }
    return `[${label}](https://kromer.club/addresses/${address})`;
}

const client = kromer.createWsClient(undefined, [
    "transactions",
]);

client.on("ready", () => {
    console.log("Connected to Kromer WS!");
});

client.on("error", err => {
    console.error(err);
});

client.on("transaction", transaction => {
    let sentNames: string[] = [];

    let from = transaction.from ?? "unknown";
    let to = transaction.to;

    const fromPlayer = playerManager.getPlayerFromAddress(from);
    const toPlayer = playerManager.getPlayerFromAddress(to);

    if (fromPlayer) {
        from = fromPlayer.minecraftName;
    }
    if (toPlayer) {
        to = toPlayer?.minecraftName;
    }

    let message = "";

    const errorEntry = transaction.meta?.entries
        .find(x => x.name.toLowerCase() === "error");
    const messageEntry = transaction.meta?.entries
        .find(x => x.name.toLowerCase() === "message");

    hook.batchedSend(`${transactionUrl(transaction)} | ${transaction.from ? addressUrl(transaction.from, from) : "unknown"} -> ${addressUrl(transaction.to, to)} | ${transaction.value.toFixed(2)} KRO${transaction.metadata ? `\n\`${transaction.metadata.replace(/`/g, "\\`")}\`` : ""}`).catch(console.error);

    playerManager.getNotifiedPlayers().forEach(player => {
        const fromSelf = transaction.from === player.kromerAddress;
        const toSelf = transaction.to === player.kromerAddress;
        if (player.notifications === "all" ||
            (player.notifications === "self" && (
                fromSelf || toSelf
            ))) {

            if (errorEntry) {
                message = `<dark_red>Error:</dark_red> <red>${errorEntry.value}</red>`;
            } else if (messageEntry) {
                message = `<blue>Message:</blue> <gray>${messageEntry.value}</gray>`;
            }

            rcc.tell(player.minecraftName, `<gray>New transaction:</gray>\n ${from} <gray>-></gray> ` +
                `${to} <gray>|</gray> ` +
                `${transaction.value.toFixed(2)} <gray>KRO</gray> ${message}`.trim()).catch(console.error);
            sentNames.push(player.minecraftName);
        }
    });

    if (sentNames.length > 0) {
        console.log(`Sent transaction (${transaction.id}) notifications to ${sentNames.join(", ")}`);
    }
});

client.connect().catch(console.error);

export default client;
