import type { EvrimaRconClient } from "../rcon/EvrimaRconClient.js";
import type { ExecuteOptions } from "../rcon/RconTypes.js";
import type { ServerProcessManager } from "../process/ServerProcessManager.js";

export class ServerService {
  constructor(
    private readonly client: EvrimaRconClient,
    private readonly processManager?: ServerProcessManager,
  ) {}

  async status(options?: ExecuteOptions) {
    const health = await this.client.healthCheck(options);
    const details = health.authenticated ? await this.client.getServerDetails(options) : undefined;
    const processStatus = this.processManager ? await this.processManager.status() : undefined;
    return {
      health,
      details,
      metrics: this.client.getMetrics(),
      process: processStatus,
    };
  }

  async announce(message: string, options?: ExecuteOptions) {
    return this.client.announce(message, options);
  }

  async save(backupName?: string, options?: ExecuteOptions) {
    return this.client.saveServer(backupName, options);
  }

  async pause(options?: ExecuteOptions) {
    return this.client.pauseServer(options);
  }

  async unpause(options?: ExecuteOptions) {
    return this.client.unpauseServer(options);
  }

  async queueStatus(options?: ExecuteOptions) {
    return this.client.getQueueStatus(options);
  }

  async restartProcess(): Promise<{ ok: boolean; output: string }> {
    if (!this.processManager) {
      throw new Error("ServerProcessManager is not configured");
    }
    return this.processManager.restart();
  }

  async startProcess(): Promise<{ ok: boolean; output: string }> {
    if (!this.processManager) {
      throw new Error("ServerProcessManager is not configured");
    }
    return this.processManager.start();
  }

  async stopProcess(): Promise<{ ok: boolean; output: string }> {
    if (!this.processManager) {
      throw new Error("ServerProcessManager is not configured");
    }
    return this.processManager.stop();
  }

  async getPlayables(options?: ExecuteOptions) {
    return this.client.getPlayables(options);
  }

  async updatePlayables(playables: string[], options?: ExecuteOptions) {
    return this.client.updatePlayables(playables, options);
  }
}
