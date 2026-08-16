import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ServerConfiguration } from "../config/serverConfig.js";

const execFileAsync = promisify(execFile);

const NICE: Record<ServerConfiguration["processPriority"], number> = {
  Normal: 0,
  AboveNormal: -5,
  High: -10,
};

export async function applyProcessTuning(pid: number, config: ServerConfiguration): Promise<string[]> {
  const notes: string[] = [];
  const nice = NICE[config.processPriority] ?? 0;
  if (nice !== 0) {
    try {
      await execFileAsync("renice", ["-n", String(nice), "-p", String(pid)], { windowsHide: true });
      notes.push(`renice ${nice}`);
    } catch (error) {
      notes.push(`renice failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const cores = config.cpuAffinity
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter((item) => /^\d+$/.test(item));
  if (cores.length > 0) {
    try {
      await execFileAsync("taskset", ["-cp", cores.join(","), String(pid)], { windowsHide: true });
      notes.push(`taskset ${cores.join(",")}`);
    } catch (error) {
      notes.push(`taskset failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return notes;
}
