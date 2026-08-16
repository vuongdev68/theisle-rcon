import type { EvrimaRconClient } from "../rcon/EvrimaRconClient.js";
import type { ExecuteOptions, Player } from "../rcon/RconTypes.js";

export class PlayerService {
  constructor(private readonly client: EvrimaRconClient) {}

  async list(options?: ExecuteOptions): Promise<Player[]> {
    const [listed, detailed] = await Promise.all([
      this.client.playerList(options).catch(() => [] as Player[]),
      this.client.getPlayerData(undefined, options).catch(() => [] as Player[]),
    ]);
    const byId = new Map<string, Player>();
    for (const player of listed) {
      byId.set(playerKey(player), player);
    }
    for (const player of detailed) {
      const key = playerKey(player);
      const previous = byId.get(key);
      byId.set(key, previous ? { ...previous, ...player, extra: { ...previous.extra, ...player.extra } } : player);
    }
    return [...byId.values()];
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

  async ban(
    playerId: string,
    reason: string,
    options?: ExecuteOptions & { name?: string; durationSeconds?: number },
  ) {
    return this.client.banPlayer(
      {
        playerId,
        reason,
        name: options?.name,
        durationSeconds: options?.durationSeconds,
      },
      undefined,
      options ? { timeout: options.timeout, allowEmptyResponse: options.allowEmptyResponse } : undefined,
    );
  }

  async directMessage(playerId: string, message: string, options?: ExecuteOptions) {
    return this.client.directMessage(playerId, message, options);
  }

  async slay(playerId: string, options?: ExecuteOptions) {
    return this.client.players.slayPlayer(playerId, options);
  }
}

function playerKey(player: Player): string {
  return player.steamId || player.eosId || player.id || player.name;
}
