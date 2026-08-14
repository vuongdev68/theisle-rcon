import type {
  PlayableEntry,
  Player,
  PlayerLocation,
  QueueStatus,
  ServerDetails,
} from "../rcon/RconTypes.js";

const TIMESTAMP_PREFIX = /^\[[^\]]+\]\s*/;

export interface ParseResult<T> {
  value: T;
  extra: Record<string, unknown>;
  raw: string;
}

export function stripResponseEnvelope(body: string, typeName?: string): string {
  let content = body.replace(/\r\n/g, "\n").replace(/\0/g, "").trim();
  content = content.replace(TIMESTAMP_PREFIX, "");
  if (typeName) {
    const header = new RegExp(`^${escapeRegExp(typeName)}\\s*`, "i");
    content = content.replace(header, "");
    const footer = new RegExp(`${escapeRegExp(typeName)}End\\s*$`, "i");
    content = content.replace(footer, "");
  }
  return content.trim();
}

export function parsePlayerListResponse(body: string): Player[] {
  const raw = body;
  const content = stripResponseEnvelope(body, "PlayerList");
  if (!content) {
    return [];
  }

  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^playerlist$/i.test(line));

  if (lines.length >= 2 && looksGrouped(lines)) {
    return parseGroupedPlayerList(lines, raw);
  }

  const joined = lines.join(",");
  return parseInterleavedPlayerList(joined, raw);
}

export function parsePlayerDataResponse(body: string): Player[] {
  const raw = body;
  const content = stripResponseEnvelope(body, "PlayerData");
  if (!content) {
    return [];
  }

  const jsonParsed = tryParseJson(content);
  if (Array.isArray(jsonParsed)) {
    return jsonParsed.map((item) => playerFromUnknown(item, raw));
  }
  if (jsonParsed && typeof jsonParsed === "object") {
    return [playerFromUnknown(jsonParsed, raw)];
  }

  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^playerdataend$/i.test(line));

  return lines.map((line) => parsePlayerDataLine(line, raw));
}

export function parseServerDetailsResponse(body: string): ServerDetails {
  const raw = body;
  const content = stripResponseEnvelope(body, "ServerDetails");
  const extra: Record<string, unknown> = {};
  const details: ServerDetails = { extra, raw };

  if (!content) {
    return details;
  }

  const jsonParsed = tryParseJson(content);
  if (jsonParsed && typeof jsonParsed === "object" && !Array.isArray(jsonParsed)) {
    assignServerDetails(details, jsonParsed as Record<string, unknown>);
    return details;
  }

  const pairs = splitKeyValues(content);
  assignServerDetails(details, pairs);
  return details;
}

export function parsePlayablesResponse(body: string): PlayableEntry[] {
  const raw = body;
  const content = stripResponseEnvelope(body, "Playables") || stripResponseEnvelope(body, "GetPlayables");
  if (!content) {
    return [];
  }

  const jsonParsed = tryParseJson(content);
  if (Array.isArray(jsonParsed)) {
    return jsonParsed.map((item) => playableFromUnknown(item, raw));
  }

  return content
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^playables$/i.test(part))
    .map((part) => {
      const [name, state] = part.split(":").map((value) => value.trim());
      const extra: Record<string, unknown> = {};
      if (state !== undefined && !["enabled", "disabled", "true", "false", "1", "0"].includes(state.toLowerCase())) {
        extra.state = state;
      }
      const entry: PlayableEntry = {
        name: name ?? part,
        extra,
        raw: part,
      };
      if (state !== undefined) {
        entry.enabled = parseLooseBoolean(state);
      }
      return entry;
    });
}

export function parseQueueStatusResponse(body: string): QueueStatus {
  const raw = body;
  const content = stripResponseEnvelope(body, "QueueStatus") || stripResponseEnvelope(body, "Queue");
  const extra: Record<string, unknown> = { ...splitKeyValues(content) };
  const jsonParsed = tryParseJson(content);
  if (jsonParsed && typeof jsonParsed === "object" && !Array.isArray(jsonParsed)) {
    Object.assign(extra, jsonParsed);
  }
  return { extra, raw };
}

function looksGrouped(lines: string[]): boolean {
  const firstCommas = (lines[0]?.match(/,/g) ?? []).length;
  const secondCommas = (lines[1]?.match(/,/g) ?? []).length;
  return firstCommas >= 1 && secondCommas >= 1;
}

function parseGroupedPlayerList(lines: string[], raw: string): Player[] {
  const steamIds = splitCsv(lines[0] ?? "");
  const names = splitCsv(lines[1] ?? "");
  const eosIds = splitCsv(lines[2] ?? "");
  const extraLines = lines.slice(3);
  const players: Player[] = [];

  for (let i = 0; i < steamIds.length; i += 1) {
    const steamId = steamIds[i];
    if (!steamId) {
      continue;
    }
    const extra: Record<string, unknown> = {};
    if (extraLines.length > 0) {
      extra.ungroupedLines = extraLines;
    }
    const player: Player = {
      id: steamId,
      name: names[i] ?? "",
      steamId,
      extra,
      raw,
    };
    const eosId = eosIds[i];
    if (eosId) {
      player.eosId = eosId;
    }
    players.push(player);
  }
  return players;
}

function parseInterleavedPlayerList(content: string, raw: string): Player[] {
  const parts = splitCsv(content);
  const players: Player[] = [];

  if (parts.length === 0) {
    return players;
  }

  const stride = detectStride(parts);
  for (let i = 0; i < parts.length; i += stride) {
    const id = parts[i];
    if (!id) {
      break;
    }
    const name = parts[i + 1] ?? "";
    const extra: Record<string, unknown> = {};
    const player: Player = { id, name, extra, raw };
    if (/^\d{17}$/.test(id)) {
      player.steamId = id;
    }
    if (stride >= 3 && parts[i + 2]) {
      const third = parts[i + 2];
      if (third) {
        player.eosId = third;
      }
    }
    if (stride > 3) {
      extra.trailingFields = parts.slice(i + 3, i + stride);
    }
    players.push(player);
  }
  return players;
}

function detectStride(parts: string[]): number {
  if (parts.length >= 3 && parts.length % 3 === 0) {
    return 3;
  }
  if (parts.length % 2 === 0) {
    return 2;
  }
  return 3;
}

function parsePlayerDataLine(line: string, raw: string): Player {
  const extra: Record<string, unknown> = {};
  const fields = parseLabeledFields(line);
  Object.assign(extra, fields);

  const name = stringField(fields, ["Name", "name", "PlayerName"]);
  const id = stringField(fields, ["PlayerID", "PlayerId", "playerId", "SteamId", "SteamID", "id"]);
  const player: Player = {
    id: id ?? name ?? "",
    name: name ?? "",
    extra,
    raw: line || raw,
  };

  const steamId = stringField(fields, ["SteamId", "SteamID", "steamId"]);
  if (steamId) {
    player.steamId = steamId;
  } else if (id && /^\d{17}$/.test(id)) {
    player.steamId = id;
  }

  const eosId = stringField(fields, ["EOSId", "EosId", "eosId"]);
  if (eosId) {
    player.eosId = eosId;
  }

  const playable = stringField(fields, ["Class", "class", "Character", "Playable", "Dino"]);
  if (playable) {
    player.playable = normalizeClassName(playable);
  }

  const gender = stringField(fields, ["Gender", "gender"]);
  if (gender) {
    player.gender = gender;
  }

  const growth = numberField(fields, ["Growth", "growth"]);
  if (growth !== undefined) {
    player.growth = growth;
  }
  const health = numberField(fields, ["Health", "health"]);
  if (health !== undefined) {
    player.health = health;
  }
  const stamina = numberField(fields, ["Stamina", "stamina"]);
  if (stamina !== undefined) {
    player.stamina = stamina;
  }
  const hunger = numberField(fields, ["Hunger", "hunger"]);
  if (hunger !== undefined) {
    player.hunger = hunger;
  }
  const thirst = numberField(fields, ["Thirst", "thirst"]);
  if (thirst !== undefined) {
    player.thirst = thirst;
  }

  const location = parseLocation(fields);
  if (location) {
    player.location = location;
  }

  const alive = stringField(fields, ["Alive", "isAlive"]);
  if (alive !== undefined) {
    player.isAlive = parseLooseBoolean(alive);
  }
  const prime = stringField(fields, ["Prime", "isPrime", "PrimeElder"]);
  if (prime !== undefined) {
    player.isPrime = parseLooseBoolean(prime);
  }
  const mutations = stringField(fields, ["Mutations", "mutations"]);
  if (mutations) {
    player.mutations = splitCsv(mutations);
  }

  return player;
}

function parseLabeledFields(line: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const regex = /([A-Za-z][A-Za-z0-9_]*)\s*[:=]\s*/g;
  const matches = [...line.matchAll(regex)];

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const key = current?.[1];
    if (!key || current?.index === undefined) {
      continue;
    }
    const valueStart = current.index + current[0].length;
    const valueEnd = next?.index ?? line.length;
    let value = line.slice(valueStart, valueEnd).trim();
    if (value.endsWith(",")) {
      value = value.slice(0, -1).trim();
    }
    fields[key] = value;
  }

  return fields;
}

function parseLocation(fields: Record<string, string>): PlayerLocation | undefined {
  const blob = stringField(fields, ["Location", "location"]);
  const x = numberFromPair(fields, "X") ?? numberFromLocationBlob(blob, "X");
  const y = numberFromPair(fields, "Y") ?? numberFromLocationBlob(blob, "Y");
  const z = numberFromPair(fields, "Z") ?? numberFromLocationBlob(blob, "Z");
  if (x === undefined && y === undefined && z === undefined) {
    return undefined;
  }
  return { x: x ?? 0, y: y ?? 0, z: z ?? 0 };
}

function numberFromLocationBlob(blob: string | undefined, axis: string): number | undefined {
  if (!blob) {
    return undefined;
  }
  const match = blob.match(new RegExp(`${axis}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`, "i"));
  if (!match?.[1]) {
    return undefined;
  }
  return Number(match[1]);
}

function assignServerDetails(details: ServerDetails, source: Record<string, unknown>): void {
  const known: Record<string, (value: unknown) => void> = {
    ServerName: (value) => {
      details.name = String(value);
    },
    name: (value) => {
      details.name = String(value);
    },
    ServerMap: (value) => {
      details.map = String(value);
    },
    map: (value) => {
      details.map = String(value);
    },
    ServerMaxPlayers: (value) => {
      details.maxPlayers = Number(value);
    },
    ServerCurrentPlayers: (value) => {
      details.currentPlayers = Number(value);
    },
    bEnableMutations: (value) => {
      details.enableMutations = parseLooseBoolean(value);
    },
    bEnableHumans: (value) => {
      details.enableHumans = parseLooseBoolean(value);
    },
    bServerPassword: (value) => {
      details.hasPassword = parseLooseBoolean(value);
    },
    bQueueEnabled: (value) => {
      details.queueEnabled = parseLooseBoolean(value);
    },
    bServerWhitelist: (value) => {
      details.whitelist = parseLooseBoolean(value);
    },
    bSpawnAI: (value) => {
      details.spawnAI = parseLooseBoolean(value);
    },
    bAllowRecordingReplay: (value) => {
      details.allowRecordingGameplay = parseLooseBoolean(value);
    },
    bUseRegionSpawning: (value) => {
      details.useRegionSpawning = parseLooseBoolean(value);
    },
    bUseRegionSpawnCooldown: (value) => {
      details.useRegionSpawnCooldown = parseLooseBoolean(value);
    },
    RegionSpawnCooldownTimeSeconds: (value) => {
      details.regionSpawnCooldownTimeSeconds = Number(value);
    },
    ServerDayLengthMinutes: (value) => {
      details.dayLengthMinutes = Number(value);
    },
    ServerNightLengthMinutes: (value) => {
      details.nightLengthMinutes = Number(value);
    },
    bEnableGlobalChat: (value) => {
      details.enableGlobalChat = parseLooseBoolean(value);
    },
  };

  for (const [key, value] of Object.entries(source)) {
    if (key === "ServerPassword" || key.toLowerCase() === "password") {
      details.extra[key] = "[redacted]";
      continue;
    }
    const assigner = known[key];
    if (assigner) {
      assigner(value);
    } else {
      details.extra[key] = value;
    }
  }
}

function playerFromUnknown(value: unknown, raw: string): Player {
  if (!value || typeof value !== "object") {
    return { id: String(value ?? ""), name: "", extra: {}, raw };
  }
  const record = value as Record<string, unknown>;
  const extra = { ...record };
  const id = String(record.PlayerId ?? record.playerId ?? record.SteamId ?? record.id ?? "");
  const name = String(record.PlayerName ?? record.Name ?? record.name ?? "");
  delete extra.PlayerId;
  delete extra.playerId;
  delete extra.SteamId;
  delete extra.id;
  delete extra.PlayerName;
  delete extra.Name;
  delete extra.name;
  const player: Player = { id, name, extra, raw };
  if (typeof record.SteamId === "string") {
    player.steamId = record.SteamId;
  }
  if (typeof record.EOSId === "string") {
    player.eosId = record.EOSId;
  }
  return player;
}

function playableFromUnknown(value: unknown, raw: string): PlayableEntry {
  if (typeof value === "string") {
    return { name: value, extra: {}, raw: value };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return {
      name: String(record.name ?? record.class ?? record.Class ?? ""),
      enabled: record.enabled === undefined ? undefined : parseLooseBoolean(record.enabled),
      extra: record,
      raw,
    };
  }
  return { name: String(value ?? ""), extra: {}, raw };
}

function splitKeyValues(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!content) {
    return result;
  }
  const tokens = content.split(/,(?=\s*[A-Za-z][A-Za-z0-9_]*\s*:)/);
  for (const token of tokens) {
    const colon = token.indexOf(":");
    if (colon === -1) {
      if (token.trim()) {
        result[`unknown_${Object.keys(result).length}`] = token.trim();
      }
      continue;
    }
    const key = token.slice(0, colon).trim();
    const value = token.slice(colon + 1).trim();
    result[key] = value;
  }
  return result;
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function stringField(fields: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = fields[key];
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return undefined;
}

function numberField(fields: Record<string, string>, keys: string[]): number | undefined {
  const value = stringField(fields, keys);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numberFromPair(fields: Record<string, string>, key: string): number | undefined {
  const value = fields[key];
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseLooseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "on", "enabled", "yes"].includes(normalized);
}

function tryParseJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function normalizeClassName(value: string): string {
  return value.replace(/^BP_/, "").replace(/_C$/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
