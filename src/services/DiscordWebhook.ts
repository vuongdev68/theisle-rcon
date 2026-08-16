const WEBHOOK_PREFIX = "https://discord.com/api/webhooks/";

export function isDiscordWebhookUrl(url: string): boolean {
  return url.startsWith(WEBHOOK_PREFIX);
}

export class DiscordWebhookService {
  async send(webhookUrl: string, payload: { title: string; description: string; color: number; fields?: Array<{ name: string; value: string; inline?: boolean }> }): Promise<boolean> {
    if (!webhookUrl || !isDiscordWebhookUrl(webhookUrl)) {
      return false;
    }
    const body = {
      embeds: [
        {
          title: payload.title,
          description: payload.description,
          color: payload.color,
          fields: payload.fields,
          timestamp: new Date().toISOString(),
          footer: { text: "Evrima Field Station" },
        },
      ],
    };
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  }

  test(url: string, serverName: string): Promise<boolean> {
    return this.send(url, {
      title: "Test notification",
      description: `Discord webhook is configured for **${serverName}**.`,
      color: 0x57f287,
    });
  }

  crash(url: string, serverName: string, uptimeMs: number): Promise<boolean> {
    return this.send(url, {
      title: "Server crash detected",
      description: `**${serverName}** stopped unexpectedly.`,
      color: 0xed4245,
      fields: [{ name: "Uptime", value: formatUptime(uptimeMs), inline: true }],
    });
  }

  start(url: string, serverName: string): Promise<boolean> {
    return this.send(url, { title: "Server started", description: `**${serverName}** is running.`, color: 0x57f287 });
  }

  stop(url: string, serverName: string): Promise<boolean> {
    return this.send(url, { title: "Server stopped", description: `**${serverName}** was stopped.`, color: 0xfee75c });
  }

  restart(url: string, serverName: string, attempt?: { current: number; max: number }): Promise<boolean> {
    const extra = attempt ? ` (attempt ${attempt.current}/${attempt.max})` : "";
    return this.send(url, {
      title: "Server restarting",
      description: `**${serverName}** is restarting${extra}.`,
      color: 0xfee75c,
    });
  }

  chat(url: string, serverName: string, messages: string[]): Promise<boolean> {
    if (messages.length === 0) {
      return Promise.resolve(true);
    }
    return this.send(url, {
      title: `${serverName} — chat`,
      description: messages.slice(0, 12).join("\n").slice(0, 3500),
      color: 0x3498db,
    });
  }
}

function formatUptime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) {
    return "Less than 1 minute";
  }
  if (minutes < 60) {
    return `${minutes} minute(s)`;
  }
  return `${Math.floor(minutes / 60)} hour(s), ${minutes % 60} minute(s)`;
}
