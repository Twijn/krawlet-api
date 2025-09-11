import {DiscordWebhook} from "./DiscordWebhook";

export const hook = new DiscordWebhook(process.env.KROMER_WEBHOOK!, {
    avatarURL: "https://www.kromer.club/images/verified/serverwelf.png",
    username: "Kromer Logs"
});
// lint-staged test