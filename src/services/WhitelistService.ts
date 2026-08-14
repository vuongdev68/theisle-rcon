import type { EvrimaRconClient } from "../rcon/EvrimaRconClient.js";
import type { ExecuteOptions } from "../rcon/RconTypes.js";

export class WhitelistService {
  constructor(private readonly client: EvrimaRconClient) {}

  async add(playerId: string | string[], options?: ExecuteOptions) {
    return this.client.addWhitelist(playerId, options);
  }

  async remove(playerId: string | string[], options?: ExecuteOptions) {
    return this.client.removeWhitelist(playerId, options);
  }

  async toggle(enabled?: boolean, options?: ExecuteOptions) {
    return this.client.toggleWhitelist(enabled, options);
  }

  async list(): Promise<never> {
    return this.client.getWhitelist();
  }
}
