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

export class DiscordWebhook {
    private readonly url: string;
    private batches: string[] = [];

    constructor(url: string, private defaultOptions: Options = {}) {
        this.url = url;

        setInterval(async () => {
            if (this.batches.length > 0) {
                try {
                    const batch = this.batches.join("\n");
                    await this.send(batch);
                    this.batches = [];
                } catch(e) {
                    console.error("Error sending batch:", e);
                }
            }
        }, 2500);
    }

    async batchedSend(message: string): Promise<void> {
        this.batches.push(message);
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


    async sendEmbed(embed: DiscordEmbed, options?: Options): Promise<DiscordWebhookResponse> {
        const payload = {
            username: options?.username,
            avatar_url: options?.avatarURL,
            embeds: [embed]
        };
        const res = await fetch(this.url, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new Error(`Webhook failed: ${res.status} ${res.statusText}`);
        }
        return res.json().catch(() => {});
    }
}
