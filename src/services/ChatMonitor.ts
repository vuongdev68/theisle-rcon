import { existsSync, openSync, readSync, statSync, closeSync } from "node:fs";

export type ChatChannel = "Global" | "Local" | "Admin";

export interface ChatMessage {
  timestamp: number;
  channel: ChatChannel;
  player: string;
  message: string;
  raw: string;
}

const CHAT_LINE = /\[(Spatial|Global|Admin)\].*?\] ([^\[]+) \[[\d]+\]: (.+)/;

export class ChatMonitor {
  private offset = 0;
  private readonly messages: ChatMessage[] = [];
  private readonly pendingWebhook: string[] = [];

  constructor(
    private readonly logPath: string,
    private readonly limit = 300,
  ) {}

  getLines(filters: ChatChannel[] = ["Global", "Local", "Admin"]): ChatMessage[] {
    const wanted = new Set(filters);
    return this.messages.filter((item) => wanted.has(item.channel));
  }

  drainWebhookQueue(): string[] {
    const queued = this.pendingWebhook.splice(0, this.pendingWebhook.length);
    return queued;
  }

  clear(): void {
    this.messages.length = 0;
  }

  poll(options: { webhook: boolean } = { webhook: false }): ChatMessage[] {
    if (!existsSync(this.logPath)) {
      return [];
    }
    const size = statSync(this.logPath).size;
    if (size < this.offset) {
      this.offset = 0;
    }
    if (size === this.offset) {
      return [];
    }
    const length = size - this.offset;
    const buffer = Buffer.alloc(Math.min(length, 2_000_000));
    const fd = openSync(this.logPath, "r");
    try {
      const read = readSync(fd, buffer, 0, buffer.length, this.offset);
      this.offset += read;
      const text = buffer.subarray(0, read).toString("utf8");
      const added: ChatMessage[] = [];
      for (const line of text.split(/\r?\n/)) {
        if (!line.includes("LogTheIsleChatData:")) {
          continue;
        }
        const parsed = parseChatLine(line);
        if (!parsed) {
          continue;
        }
        this.messages.push(parsed);
        added.push(parsed);
        if (options.webhook) {
          this.pendingWebhook.push(`**[${parsed.channel}]** ${parsed.player}: ${parsed.message}`);
        }
      }
      while (this.messages.length > this.limit) {
        this.messages.shift();
      }
      return added;
    } finally {
      closeSync(fd);
    }
  }
}

export function parseChatLine(line: string, now = Date.now()): ChatMessage | undefined {
  const match = line.match(CHAT_LINE);
  if (!match) {
    return undefined;
  }
  const rawChannel = match[1] ?? "Global";
  const channel: ChatChannel = rawChannel === "Spatial" ? "Local" : rawChannel === "Admin" ? "Admin" : "Global";
  return {
    timestamp: now,
    channel,
    player: (match[2] ?? "").trim(),
    message: match[3] ?? "",
    raw: line,
  };
}
