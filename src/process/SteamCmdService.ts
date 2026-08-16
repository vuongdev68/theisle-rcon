import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

const STEAM_APP_ID = "412680";

export class SteamCmdService {
  running = false;
  lastOutput: string[] = [];
  lastError?: string;
  lastFinishedAt?: number;

  constructor(
    private readonly serverDir: string,
    private readonly steamCmdPath: string,
  ) {}

  get available(): boolean {
    return this.serverDir.trim().length > 0 && this.steamCmdPath.trim().length > 0 && existsSync(this.steamCmdPath);
  }

  async installOrValidate(validate: boolean): Promise<{ ok: boolean; output: string }> {
    if (!this.serverDir) {
      throw new Error("SERVER_DIR is not set");
    }
    if (!existsSync(this.steamCmdPath)) {
      throw new Error(`SteamCMD not found at ${this.steamCmdPath}`);
    }
    if (this.running) {
      throw new Error("SteamCMD is already running");
    }
    mkdirSync(this.serverDir, { recursive: true });
    this.running = true;
    this.lastOutput = [];
    this.lastError = undefined;
    const args = [
      "+force_install_dir",
      this.serverDir,
      "+login",
      "anonymous",
      "+app_update",
      STEAM_APP_ID,
      "-beta",
      "evrima",
    ];
    if (validate) {
      args.push("validate");
    }
    args.push("+quit");
    try {
      const output = await this.run(args);
      this.lastFinishedAt = Date.now();
      return { ok: true, output };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.lastFinishedAt = Date.now();
      throw error;
    } finally {
      this.running = false;
    }
  }

  private run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.steamCmdPath, args, { windowsHide: true });
      let output = "";
      const push = (chunk: Buffer): void => {
        const text = chunk.toString("utf8");
        output += text;
        for (const line of text.split(/\r?\n/).filter(Boolean)) {
          this.lastOutput.push(line);
          if (this.lastOutput.length > 400) {
            this.lastOutput.shift();
          }
        }
      };
      child.stdout.on("data", push);
      child.stderr.on("data", push);
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve(output.trim());
          return;
        }
        reject(new Error(`SteamCMD exited ${code ?? "unknown"}\n${output.slice(-2000)}`));
      });
    });
  }
}
