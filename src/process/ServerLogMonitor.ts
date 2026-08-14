import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { TypedEventEmitter } from "../events/EventEmitter.js";

export interface ServerLogMonitorEvents {
  logLine: { line: string; timestamp: number };
  error: { error: Error };
  stopped: { reason?: string };
}

export interface ServerLogMonitorOptions {
  unit?: string;
  journalctlPath?: string;
}

/**
 * Follows journalctl for The Isle dedicated server.
 * Independent from the RCON TCP client.
 */
export class ServerLogMonitor extends TypedEventEmitter<ServerLogMonitorEvents> {
  private child: ChildProcessWithoutNullStreams | undefined;
  private leftover = "";
  private readonly unit: string;
  private readonly journalctlPath: string;
  private readonly recent: Array<{ line: string; timestamp: number }> = [];
  private readonly recentLimit: number;

  constructor(options: ServerLogMonitorOptions = {}) {
    super();
    this.unit = options.unit ?? "theisle";
    this.journalctlPath = options.journalctlPath ?? "/usr/bin/journalctl";
    this.recentLimit = 300;
  }

  start(): void {
    if (this.child) {
      return;
    }

    const child = spawn(this.journalctlPath, ["-u", this.unit, "-f", "-o", "cat"], {
      windowsHide: true,
    });
    this.child = child;

    child.stdout.on("data", (chunk: Buffer) => {
      this.leftover += chunk.toString("utf8");
      const lines = this.leftover.split(/\r?\n/);
      this.leftover = lines.pop() ?? "";
      for (const line of lines) {
        if (line.length > 0) {
          const entry = { line, timestamp: Date.now() };
          this.recent.push(entry);
          if (this.recent.length > this.recentLimit) {
            this.recent.shift();
          }
          this.emit("logLine", entry);
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const message = chunk.toString("utf8").trim();
      if (message) {
        this.emit("error", { error: new Error(message) });
      }
    });

    child.on("error", (error: Error) => {
      this.emit("error", { error });
    });

    child.on("close", (code) => {
      this.child = undefined;
      this.emit("stopped", { reason: `exit_${code ?? "unknown"}` });
    });
  }

  stop(): void {
    if (!this.child) {
      return;
    }
    this.child.kill("SIGTERM");
    this.child = undefined;
  }

  isRunning(): boolean {
    return this.child !== undefined;
  }

  getRecentLines(): Array<{ line: string; timestamp: number }> {
    return [...this.recent];
  }
}
