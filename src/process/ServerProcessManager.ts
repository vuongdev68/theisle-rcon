import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type SystemctlAction = "status" | "start" | "stop" | "restart";

const ALLOWED_ACTIONS = new Set<SystemctlAction>(["status", "start", "stop", "restart"]);

export interface ServerProcessManagerOptions {
  unit?: string;
  systemctlPath?: string;
  timeoutMs?: number;
}

export interface ProcessCommandResult {
  ok: boolean;
  action: SystemctlAction;
  unit: string;
  output: string;
}

/**
 * systemd process control for The Isle dedicated server.
 * Isolated from the RCON protocol layer. No arbitrary shell commands.
 */
export class ServerProcessManager {
  private readonly unit: string;
  private readonly systemctlPath: string;
  private readonly timeoutMs: number;

  constructor(options: ServerProcessManagerOptions = {}) {
    this.unit = options.unit ?? "theisle";
    this.systemctlPath = options.systemctlPath ?? "/usr/bin/systemctl";
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async status(): Promise<ProcessCommandResult> {
    return this.run("status");
  }

  async start(): Promise<ProcessCommandResult> {
    return this.run("start");
  }

  async stop(): Promise<ProcessCommandResult> {
    return this.run("stop");
  }

  async restart(): Promise<ProcessCommandResult> {
    return this.run("restart");
  }

  private async run(action: SystemctlAction): Promise<ProcessCommandResult> {
    if (!ALLOWED_ACTIONS.has(action)) {
      throw new Error(`Unsupported systemctl action: ${String(action)}`);
    }

    try {
      const { stdout, stderr } = await execFileAsync(this.systemctlPath, [action, this.unit], {
        timeout: this.timeoutMs,
        windowsHide: true,
      });
      return {
        ok: true,
        action,
        unit: this.unit,
        output: `${stdout}${stderr}`.trim(),
      };
    } catch (error) {
      const output = formatExecError(error);
      if (action === "status") {
        return { ok: false, action, unit: this.unit, output };
      }
      throw new Error(`systemctl ${action} ${this.unit} failed: ${output}`);
    }
  }
}

function formatExecError(error: unknown): string {
  if (error && typeof error === "object") {
    const record = error as { stdout?: string; stderr?: string; message?: string };
    return `${record.stdout ?? ""}${record.stderr ?? record.message ?? ""}`.trim();
  }
  return String(error);
}
