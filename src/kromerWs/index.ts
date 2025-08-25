import kromer from "../lib/kromer";
import playerManager from "../lib/managers/playerManager";
import {rcc} from "../chat";

import {hook} from "../lib/webhook";
import {Transaction, TransactionWithMeta} from "kromer";
import {HATransactions} from "../lib/HATransactions";

const STRIPPED_META_ENTRIES = ["error", "message", "return"];

interface TransactionData {
    from: string;
    to: string;
    entries: {
        error?: string;
        message?: string;
    }
}

type Handler = (transaction: TransactionWithMeta, data: TransactionData) => void;

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

function sendDiscordMessage(transaction: TransactionWithMeta, data: TransactionData) {
    let metadata = "";

    if (data.entries.error) {
        metadata += `\n:x: *${data.entries.error}*`;
    }
    if (data.entries.message) {
        metadata += `\n:speech_balloon: *${data.entries.message}*`;
    }

    let strippedEntries = transaction?.meta?.entries ?
        transaction.meta.entries.filter(x => !STRIPPED_META_ENTRIES.includes(x.name.toLowerCase())) : [];
    if (strippedEntries.length > 0) {
        metadata += "\n`" + `${strippedEntries.map(x => `${x.name}${x.value ? `=${x.value}` : ""}`).join(";")}`
            .replace(/`/g, "\\`") + "`";
    }

    hook.batchedSend(`${transactionUrl(transaction)} | ${transaction.from ? addressUrl(transaction.from, data.from) : "unknown"} -> ${addressUrl(transaction.to, data.to)} | ${transaction.value.toFixed(2)} KRO${metadata}`).catch(console.error);
}

function sendInGameMessage(transaction: TransactionWithMeta, data: TransactionData) {
    let sentNames: string[] = [];
    let message = "";

    if (data.entries.error) {
        message = `<dark_red>Error:</dark_red> <red>${data.entries.error}</red>`;
    } else if (data.entries.message) {
        message = `<blue>Message:</blue> <gray>${data.entries.message}</gray>`;
    }

    playerManager.getNotifiedPlayers().forEach(player => {
        const fromSelf = transaction.from === player.kromerAddress;
        const toSelf = transaction.to === player.kromerAddress;
        if (player.notifications === "all" ||
            (player.notifications === "self" && (
                fromSelf || toSelf
            ))) {

            rcc.tell(player.minecraftName, `<gray>New transaction:</gray>\n ${data.from} <gray>-></gray> ` +
                `${data.to} <gray>|</gray> ` +
                `${transaction.value.toFixed(2)} <gray>KRO</gray> ${message}`.trim()).catch(console.error);
            sentNames.push(player.minecraftName);
        }
    });

    if (sentNames.length > 0) {
        console.log(`Sent transaction (${transaction.id}) notifications to ${sentNames.join(", ")}`);
    }
}

const handlers: Handler[] = [
    sendDiscordMessage,
    sendInGameMessage,
];

const haTransactions = new HATransactions(kromer);

haTransactions.on((transaction: TransactionWithMeta) => {
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

    const errorEntry = transaction.meta?.entries
        ?.find(x => x.name.toLowerCase() === "error");
    const messageEntry = transaction.meta?.entries
        ?.find(x => x.name.toLowerCase() === "message");

    const data: TransactionData = {
        from, to,
        entries: {
            error: errorEntry?.value,
            message: messageEntry?.value,
        }
    }

    handlers.forEach(handler => {
        try {
            handler(transaction, data);
        } catch (error) {
            console.error('Error in transaction handler:', error);
        }
    });
});

export default haTransactions;
