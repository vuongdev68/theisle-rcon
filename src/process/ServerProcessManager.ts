import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type SystemctlAction = "status" | "start" | "stop" | "restart" | "kill";
export type ProcessLifeState = "not_installed" | "stopped" | "starting" | "running" | "stopping" | "failed";

const ALLOWED_ACTIONS = new Set<SystemctlAction>(["status", "start", "stop", "restart", "kill"]);

export interface ServerProcessManagerOptions {
  unit?: string;
  systemctlPath?: string;
  timeoutMs?: number;
  serverDir?: string;
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
  private readonly serverDir: string;

  constructor(options: ServerProcessManagerOptions = {}) {
    this.unit = options.unit ?? "theisle";
    this.systemctlPath = options.systemctlPath ?? "/usr/bin/systemctl";
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.serverDir = options.serverDir ?? "";
  }

  isInstalled(): boolean {
    if (!this.serverDir) {
      return true;
    }
    const candidates = [
      join(this.serverDir, "TheIsleServer.sh"),
      join(this.serverDir, "TheIsle", "Binaries", "Linux", "TheIsleServer-Linux-Shipping"),
      join(this.serverDir, "TheIsleServer-Linux-Shipping"),
      join(this.serverDir, "TheIsleServer.exe"),
    ];
    return candidates.some((path) => existsSync(path));
  }

  async inspect(): Promise<{
    state: ProcessLifeState;
    active: boolean;
    mainPid?: number;
    subState?: string;
    installed: boolean;
  }> {
    const installed = this.isInstalled();
    try {
      const { stdout } = await execFileAsync(this.systemctlPath, ["show", this.unit, "-p", "ActiveState", "-p", "SubState", "-p", "MainPID"], {
        timeout: this.timeoutMs,
        windowsHide: true,
      });
      const fields = Object.fromEntries(
        stdout
          .split(/\r?\n/)
          .map((line) => line.split("="))
          .filter((pair) => pair.length >= 2)
          .map(([key, ...rest]) => [key, rest.join("=")]),
      );
      const activeState = fields.ActiveState ?? "unknown";
      const subState = fields.SubState;
      const mainPid = Number(fields.MainPID);
      const active = activeState === "active";
      let state: ProcessLifeState = "stopped";
      if (active) {
        state = "running";
      } else if (!installed) {
        state = "not_installed";
      } else if (activeState === "activating") {
        state = "starting";
      } else if (activeState === "deactivating") {
        state = "stopping";
      } else if (activeState === "failed") {
        state = "failed";
      }
      return {
        state,
        active,
        mainPid: Number.isFinite(mainPid) && mainPid > 0 ? mainPid : undefined,
        subState,
        installed,
      };
    } catch {
      return { state: installed ? "stopped" : "not_installed", active: false, installed };
    }
  }

  async kill(signal = "SIGKILL"): Promise<ProcessCommandResult> {
    try {
      const { stdout, stderr } = await execFileAsync(this.systemctlPath, ["kill", "-s", signal, this.unit], {
        timeout: this.timeoutMs,
        windowsHide: true,
      });
      return { ok: true, action: "kill", unit: this.unit, output: `${stdout}${stderr}`.trim() };
    } catch (error) {
      throw new Error(`systemctl kill ${this.unit} failed: ${formatExecError(error)}`);
    }
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
