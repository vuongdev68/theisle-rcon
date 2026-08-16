import type { EvrimaRconClient } from "../rcon/EvrimaRconClient.js";
import type { ExecuteOptions, Player } from "../rcon/RconTypes.js";

export class PlayerService {
  constructor(private readonly client: EvrimaRconClient) {}

  async list(options?: ExecuteOptions): Promise<Player[]> {
    return this.client.playerList(options);
  }

  async getById(playerId: string, options?: ExecuteOptions): Promise<Player | undefined> {
    const detailed = await this.client.getPlayerData(playerId, options);
    if (detailed.length > 0) {
      return detailed[0];
    }
    const online = await this.client.playerList(options);
    return online.find((player) => player.id === playerId || player.steamId === playerId || player.eosId === playerId);
  }

  async kick(playerId: string, reason?: string, options?: ExecuteOptions) {
    return this.client.kickPlayer(playerId, reason, options);
  }

  async ban(playerId: string, reason: string, options?: ExecuteOptions) {
    return this.client.players.banPlayer({ playerId, reason }, options);
  }

  async directMessage(playerId: string, message: string, options?: ExecuteOptions) {
    return this.client.directMessage(playerId, message, options);
  }

  async slay(playerId: string, options?: ExecuteOptions) {
    return this.client.players.slayPlayer(playerId, options);
  }
}
