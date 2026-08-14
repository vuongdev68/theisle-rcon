import type { EvrimaRconClient } from "../rcon/EvrimaRconClient.js";
import type { PlayerMonitor } from "./PlayerMonitor.js";
import type { ServerLogMonitor } from "../process/ServerLogMonitor.js";

export class MonitoringService {
  constructor(
    private readonly client: EvrimaRconClient,
    private readonly playerMonitor?: PlayerMonitor,
    private readonly logMonitor?: ServerLogMonitor,
  ) {}

  startPlayerMonitor(): void {
    this.playerMonitor?.start();
  }

  stopPlayerMonitor(): void {
    this.playerMonitor?.stop();
  }

  startLogMonitor(): void {
    this.logMonitor?.start();
  }

  stopLogMonitor(): void {
    this.logMonitor?.stop();
  }

  getMetrics() {
    return this.client.getMetrics();
  }

  async healthCheck() {
    return this.client.healthCheck();
  }

  getOnlinePlayers() {
    return this.playerMonitor?.getSnapshot() ?? [];
  }

  getRecentLines(): Array<{ line: string; timestamp: number }> {
    return this.logMonitor?.getRecentLines() ?? [];
  }

  isLogMonitorRunning(): boolean {
    return this.logMonitor?.isRunning() ?? false;
  }
}
