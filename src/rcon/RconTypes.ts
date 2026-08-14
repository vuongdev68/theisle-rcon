/**
 * Evrima RCON protocol types.
 *
 * The Isle: Evrima does NOT use Source RCON.
 * Packets have no length prefix and no on-wire request ID.
 * Request IDs in this client are assigned locally for tracking.
 */

export const PacketType = {
  Auth: 0x01,
  ExecCommand: 0x02,
  ResponseValue: 0x03,
} as const;

export type PacketTypeValue = (typeof PacketType)[keyof typeof PacketType];

export const PacketTerminator = 0x00;

export const AuthResponse = {
  Accepted: "Password Accepted",
  Incorrect: "Incorrect Password",
} as const;

export interface RconConfig {
  host: string;
  port: number;
  password: string;
  timeoutMs?: number;
  reconnect?: boolean;
  reconnectDelayMs?: number;
  reconnectMaxDelayMs?: number;
  reconnectMultiplier?: number;
  reconnectMaxAttempts?: number;
  responseIdleMs?: number;
  initialRequestId?: number;
}

export interface ExecuteOptions {
  timeout?: number;
  /** If true, an empty response after timeout is treated as success (silent commands). */
  allowEmptyResponse?: boolean;
}

export interface RconExecutor {
  execute(command: string, options?: ExecuteOptions): Promise<RconResponse>;
  executeOpcode(
    opcode: number,
    args?: string,
    options?: ExecuteOptions & { commandName?: string; verified?: boolean },
  ): Promise<RconResponse>;
}

export interface RconResponse {
  requestId: number;
  type: number;
  body: string;
  raw?: Buffer;
}

export interface PendingRequest {
  requestId: number;
  resolve: (response: RconResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  createdAt: number;
  command: string;
  opcode?: number;
  allowEmptyResponse: boolean;
}

export interface QueuedCommand {
  requestId: number;
  packet: Buffer;
  command: string;
  opcode?: number;
  timeoutMs: number;
  allowEmptyResponse: boolean;
  createdAt: number;
  resolve: (response: RconResponse) => void;
  reject: (error: Error) => void;
}

export interface HealthCheckResult {
  connected: boolean;
  authenticated: boolean;
  latency: number | null;
}

export interface RconMetrics {
  totalCommands: number;
  successfulCommands: number;
  failedCommands: number;
  timeoutCount: number;
  reconnectCount: number;
  averageLatencyMs: number;
  connectionState: ConnectionState;
  playerCount: number;
  authenticated: boolean;
}

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "authenticating"
  | "authenticated"
  | "reconnecting"
  | "error";

export interface Player {
  id: string;
  name: string;
  steamId?: string;
  eosId?: string;
  playable?: string;
  growth?: number;
  gender?: string;
  location?: PlayerLocation;
  health?: number;
  stamina?: number;
  hunger?: number;
  thirst?: number;
  isAlive?: boolean;
  isPrime?: boolean;
  mutations?: string[];
  extra: Record<string, unknown>;
  raw: string;
}

export interface PlayerLocation {
  x: number;
  y: number;
  z: number;
}

export interface ServerDetails {
  name?: string;
  map?: string;
  maxPlayers?: number;
  currentPlayers?: number;
  enableMutations?: boolean;
  enableHumans?: boolean;
  hasPassword?: boolean;
  queueEnabled?: boolean;
  whitelist?: boolean;
  spawnAI?: boolean;
  allowRecordingGameplay?: boolean;
  useRegionSpawning?: boolean;
  useRegionSpawnCooldown?: boolean;
  regionSpawnCooldownTimeSeconds?: number;
  dayLengthMinutes?: number;
  nightLengthMinutes?: number;
  enableGlobalChat?: boolean;
  enableMigration?: boolean;
  enableGrowthMultiplier?: boolean;
  growthMultiplier?: number;
  extra: Record<string, unknown>;
  raw: string;
}

export interface QueueStatus {
  extra: Record<string, unknown>;
  raw: string;
}

export interface PlayableEntry {
  name: string;
  enabled?: boolean;
  extra: Record<string, unknown>;
  raw: string;
}

export interface BanPlayerOptions {
  playerId: string;
  reason: string;
  name?: string;
  durationSeconds?: number;
}

export interface KickPlayerOptions {
  playerId: string;
  reason?: string;
}

export interface DirectMessageOptions {
  playerId: string;
  message: string;
}

export interface PlayableUpdate {
  className: string;
  enabled: boolean;
}

export interface CommandDefinition {
  name: string;
  opcode: number;
  verified: boolean;
  expectsResponse: boolean;
  description: string;
  argumentFormat?: string;
  sources: string[];
}

export type RconEventMap = {
  connected: { host: string; port: number };
  disconnected: { reason?: string };
  authenticated: Record<string, never>;
  authenticationFailed: { reason: string };
  error: { error: Error };
  commandSent: { requestId: number; command: string };
  commandResponse: { requestId: number; command: string; body: string; latencyMs: number };
  timeout: { requestId: number; command: string; timeoutMs: number };
  reconnecting: { attempt: number; delayMs: number };
  playerJoined: Player;
  playerLeft: Player;
  playerChanged: { previous: Player; current: Player };
};
