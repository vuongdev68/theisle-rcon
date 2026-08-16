import { existsSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

export interface BackupInfo {
  name: string;
  path: string;
  size: number;
  mtime: number;
}

export class BackupService {
  constructor(private readonly serverDir: string) {}

  get backupDir(): string {
    return join(this.serverDir, "Backups");
  }

  get savedDir(): string {
    return join(this.serverDir, "TheIsle", "Saved");
  }

  list(): BackupInfo[] {
    if (!existsSync(this.backupDir)) {
      return [];
    }
    return readdirSync(this.backupDir)
      .filter((name) => name.startsWith("SavedBackup_") && name.endsWith(".tar.gz"))
      .map((name) => {
        const path = join(this.backupDir, name);
        const stat = statSync(path);
        return { name, path, size: stat.size, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  }

  async create(): Promise<BackupInfo> {
    if (!existsSync(this.savedDir)) {
      throw new Error(`Saved folder not found: ${this.savedDir}`);
    }
    mkdirSync(this.backupDir, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
    const name = `SavedBackup_${stamp}.tar.gz`;
    const path = join(this.backupDir, name);
    await runTar(["-czf", path, "-C", this.savedDir, "--exclude=Logs", "."]);
    const stat = statSync(path);
    return { name, path, size: stat.size, mtime: stat.mtimeMs };
  }

  async restore(name: string): Promise<void> {
    const backup = this.list().find((item) => item.name === name);
    if (!backup) {
      throw new Error("Backup not found");
    }
    mkdirSync(this.backupDir, { recursive: true });
    if (existsSync(this.savedDir)) {
      const pre = join(this.backupDir, `PreRestore_${new Date().toISOString().replaceAll(":", "-").slice(0, 19)}.tar.gz`);
      await runTar(["-czf", pre, "-C", this.savedDir, "."]);
      rmSync(this.savedDir, { recursive: true, force: true });
    }
    mkdirSync(this.savedDir, { recursive: true });
    await runTar(["-xzf", backup.path, "-C", this.savedDir]);
  }

  cleanup(keepCount = 10): void {
    for (const extra of this.list().slice(keepCount)) {
      try {
        unlinkSync(extra.path);
      } catch {
        // ignore locked files
      }
    }
  }
}

function runTar(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("tar", args, { windowsHide: true });
    let err = "";
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(err.trim() || `tar exited ${code}`));
    });
  });
}
