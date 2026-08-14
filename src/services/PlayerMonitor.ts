import { TypedEventEmitter } from "../events/EventEmitter.js";
import type { EvrimaRconClient } from "../rcon/EvrimaRconClient.js";
import type { Player } from "../rcon/RconTypes.js";
import { getLogger, rconLogMessage } from "../utils/logger.js";

export interface PlayerMonitorEvents {
  playerJoined: Player;
  playerLeft: Player;
  playerChanged: { previous: Player; current: Player };
}

export interface PlayerMonitorOptions {
  intervalMs?: number;
}

function playerKey(player: Player): string {
  return player.steamId ?? player.eosId ?? player.id;
}

export class PlayerMonitor extends TypedEventEmitter<PlayerMonitorEvents> {
  private timer: ReturnType<typeof setInterval> | undefined;
  private previous = new Map<string, Player>();
  private running = false;
  private polling = false;

  constructor(
    private readonly client: EvrimaRconClient,
    private readonly options: PlayerMonitorOptions = {},
  ) {
    super();
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    const intervalMs = this.options.intervalMs ?? 5000;
    getLogger().info(rconLogMessage(`PlayerMonitor started interval=${intervalMs}ms`));
    void this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  getSnapshot(): Player[] {
    return [...this.previous.values()];
  }

  private async poll(): Promise<void> {
    if (!this.running || this.polling || !this.client.isAuthenticated()) {
      return;
    }
    this.polling = true;
    try {
      const players = await this.client.playerList();
      this.client.setPlayerCount(players.length);
      this.diff(players);
    } catch (error) {
      getLogger().warn(
        { err: error instanceof Error ? error.message : error },
        rconLogMessage("PlayerMonitor poll failed"),
      );
    } finally {
      this.polling = false;
    }
  }

  private diff(currentPlayers: Player[]): void {
    const current = new Map<string, Player>();
    for (const player of currentPlayers) {
      current.set(playerKey(player), player);
    }

    for (const [key, player] of current) {
      const previous = this.previous.get(key);
      if (!previous) {
        this.emit("playerJoined", player);
        continue;
      }
      if (previous.name !== player.name || previous.eosId !== player.eosId) {
        this.emit("playerChanged", { previous, current: player });
      }
    }

    for (const [key, player] of this.previous) {
      if (!current.has(key)) {
        this.emit("playerLeft", player);
      }
    }

    this.previous = current;
  }
}
