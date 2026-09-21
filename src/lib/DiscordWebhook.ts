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
  allowed_mentions?: {
    parse?: ('users' | 'roles' | 'everyone')[];
  };
}

export class DiscordWebhook {
  private readonly url: string;

  constructor(
    url: string,
    private defaultOptions: Options = {},
  ) {
    this.url = url;
  }

  async send(
    content: string,
    options?: Options,
    wait: boolean = false,
  ): Promise<DiscordWebhookResponse> {
    const payload: Payload = {
      username: options?.username || this.defaultOptions.username,
      avatar_url: options?.avatarURL || this.defaultOptions.avatarURL,
      content,
      allowed_mentions: { parse: [] }, // Disable all mention parsing
    };

    const res = await fetch(this.url + (wait ? '?wait=true' : ''), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
