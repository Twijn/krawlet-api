import kromer from "../lib/kromer";
import playerManager from "../lib/managers/playerManager";
import {rcc} from "../chat";

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

    playerManager.getNotifiedPlayers().forEach(player => {
        const fromSelf = transaction.from === player.kromerAddress;
        const toSelf = transaction.to === player.kromerAddress;
        if (player.notifications === "all" ||
            (player.notifications === "self" && (
                fromSelf || toSelf
            ))) {

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

    console.log(`Sent transaction (${transaction.id}) notifications to ${sentNames.join(", ")}`);
});

client.connect().catch(console.error);

export default client;
