import type { Player, ServerDetails } from "../rcon/RconTypes.js";

export interface PlayServerInfo {
  name?: string;
  map?: string;
  players: number;
  maxPlayers?: number;
  connected: boolean;
}

export interface PlayMarker {
  name: string;
  playable?: string;
  x?: number;
  y?: number;
  me: boolean;
}

export interface PlayVitals {
  steamId: string;
  name: string;
  playable?: string;
  gender?: string;
  growth?: number;
  health?: number;
  hunger?: number;
  thirst?: number;
  stamina?: number;
  isAlive?: boolean;
  isPrime?: boolean;
  mutations?: string[];
  location?: { x: number; y: number; z: number };
}

export interface PlaySnapshot {
  server: PlayServerInfo;
  markers: PlayMarker[];
  me: PlayVitals | null;
  inventory: {
    supported: false;
    stomach?: number;
    water?: number;
  };
}

export function normalizeSteamId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!/^\d{15,20}$/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function findPlayerBySteamId(players: Player[], id: string): Player | undefined {
  return players.find((player) => player.steamId === id || player.id === id);
}

export function toPlayMarker(player: Player, me: boolean): PlayMarker {
  return {
    name: player.name,
    playable: player.playable,
    x: player.location?.x,
    y: player.location?.y,
    me,
  };
}

export function toPlayVitals(player: Player): PlayVitals {
  return {
    steamId: player.steamId ?? player.id,
    name: player.name,
    playable: player.playable,
    gender: player.gender,
    growth: player.growth,
    health: player.health,
    hunger: player.hunger,
    thirst: player.thirst,
    stamina: player.stamina,
    isAlive: player.isAlive,
    isPrime: player.isPrime,
    mutations: player.mutations,
    location: player.location,
  };
}

export function buildPlaySnapshot(
  data: { players: Player[]; details: ServerDetails | undefined; connected: boolean },
  steamId?: string,
): PlaySnapshot {
  const mePlayer = steamId ? findPlayerBySteamId(data.players, steamId) : undefined;
  const me = mePlayer ? toPlayVitals(mePlayer) : null;
  return {
    server: {
      name: data.details?.name,
      map: data.details?.map,
      players: data.players.length,
      maxPlayers: data.details?.maxPlayers,
      connected: data.connected,
    },
    markers: data.players.map((player) => toPlayMarker(player, mePlayer !== undefined && samePlayer(player, mePlayer))),
    me,
    inventory: {
      supported: false,
      stomach: me?.hunger,
      water: me?.thirst,
    },
  };
}

function samePlayer(left: Player, right: Player): boolean {
  if (left.steamId && right.steamId && left.steamId === right.steamId) {
    return true;
  }
  return left.id === right.id;
}
