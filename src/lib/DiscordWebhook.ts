export interface DiscordWebhookResponse {
    id: string;
    type: number;
    channel_id: string;
    guild_id?: string;
    application_id?: string;
}

export interface DiscordEmbed {
    title?: string;
    description?: string;
    url?: string;
    color?: number;
    fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
    }>;
    author?: {
        name?: string;
        url?: string;
        icon_url?: string;
    };
    thumbnail?: {
        url: string;
    };
    image?: {
        url: string;
    };
    footer?: {
        text: string;
        icon_url?: string;
    };
    timestamp?: string;
}

export interface Options {
    username?: string;
    avatarURL?: string;
}

export interface Payload {
    content: string;
    username?: string;
    avatar_url?: string;
}

export interface BatchMessage {
    id: number;
    content: string;
    tries: number;
}

const MAX_TRIES = 3;

export class DiscordWebhook {
    private readonly url: string;
    private batches: BatchMessage[] = [];
    private batchId = 0;

    constructor(url: string, private defaultOptions: Options = {}) {
        this.url = url;

        setInterval(async () => {
            this.batches = this.batches.filter(
                batch => batch.content.length < 1950 && batch.tries < MAX_TRIES
            );

            if (this.batches.length > 0) {
                let thisBatch: BatchMessage[] = [];
                for (const message of this.batches) {
                    if (thisBatch.map(x => x.content).join("\n").length + message.content.length > 1990) break;
                    thisBatch.push(message);
                }
                try {
                    const batch = thisBatch.map(x => x.content).join("\n");
                    await this.send(batch);
                    this.batches = this.batches.filter(b => !thisBatch.find(x => x.id === b.id));
                } catch(e) {
                    this.batches = this.batches.map(b => {
                        if (thisBatch.find(x => x.id === b.id)) {
                            return {
                                ...b,
                                tries: b.tries + 1,
                            }
                        }
                        return b;
                    });
                    console.error("Error sending batch:", e);
                }
            }
        }, 5_000);
    }

    async batchedSend(message: string): Promise<void> {
        this.batches.push({
            id: this.batchId++,
            content: message,
            tries: 0,
        });
    }

    async send(content: string, options?: Options, wait: boolean = false): Promise<DiscordWebhookResponse> {
        const payload: Payload = {
            username: options?.username || this.defaultOptions.username,
            avatar_url: options?.avatarURL || this.defaultOptions.avatarURL,
            content,
        };

        const res = await fetch(this.url + (wait ? "?wait=true" : ""), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new Error(`Webhook failed: ${res.status} ${res.statusText}`);
        }
        return res.json().catch(() => ({}));
    }


    // this needs some work + I'm lazy
    // async sendEmbed(embed: DiscordEmbed, options?: Options): Promise<DiscordWebhookResponse> {
    //     const payload = {
    //         username: options?.username,
    //         avatar_url: options?.avatarURL,
    //         embeds: [embed]
    //     };
    //     const res = await fetch(this.url, {
    //         method: "POST",
    //         headers: {"Content-Type": "application/json"},
    //         body: JSON.stringify(payload),
    //     });
    //
    //     if (!res.ok) {
    //         throw new Error(`Webhook failed: ${res.status} ${res.statusText}`);
    //     }
    //     return res.json().catch(() => {});
    // }
}
