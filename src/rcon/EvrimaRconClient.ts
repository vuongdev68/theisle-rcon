import type { Logger } from "pino";
import { TypedEventEmitter } from "../events/EventEmitter.js";
import { getLogger, rconLogMessage } from "../utils/logger.js";
import { computeBackoffDelay, sleep } from "../utils/retry.js";
import {
  getCommandDefinition,
} from "../commands/commandRegistry.js";
import { PlayerCommands } from "../commands/PlayerCommands.js";
import { ServerCommands } from "../commands/ServerCommands.js";
import { AdminCommands } from "../commands/AdminCommands.js";
import { AICommands } from "../commands/AICommands.js";
import { WhitelistCommands } from "../commands/WhitelistCommands.js";
import { PlayableCommands } from "../commands/PlayableCommands.js";
import type { PlayerMonitor } from "../services/PlayerMonitor.js";
import { RconConnection, assertAuthenticatedResponse } from "./RconConnection.js";
import { evrimaProtocol } from "./EvrimaRconProtocol.js";
import {
  RconAuthenticationError,
  RconCommandError,
  RconConnectionError,
  RconTimeoutError,
} from "./RconErrors.js";
import type { DecodedPacket } from "./RconPacket.js";
import type {
  BanPlayerOptions,
  ConnectionState,
  DirectMessageOptions,
  ExecuteOptions,
  HealthCheckResult,
  KickPlayerOptions,
  PlayableEntry,
  PlayableUpdate,
  Player,
  QueueStatus,
  QueuedCommand,
  RconConfig,
  RconEventMap,
  RconMetrics,
  RconResponse,
  ServerDetails,
} from "./RconTypes.js";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RECONNECT_DELAY_MS = 1000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30_000;
const DEFAULT_RECONNECT_MULTIPLIER = 2;
const DEFAULT_RESPONSE_IDLE_MS = 150;
const DEFAULT_INITIAL_REQUEST_ID = 1001;

export class EvrimaRconClient extends TypedEventEmitter<RconEventMap> {
  private readonly config: Required<
    Pick<
      RconConfig,
      | "host"
      | "port"
      | "password"
      | "timeoutMs"
      | "reconnect"
      | "reconnectDelayMs"
      | "reconnectMaxDelayMs"
      | "reconnectMultiplier"
      | "reconnectMaxAttempts"
      | "responseIdleMs"
      | "initialRequestId"
    >
  >;
  private readonly logger: Logger;
  private connection: RconConnection;
  private authenticated = false;
  private state: ConnectionState = "disconnected";
  private nextRequestId: number;
  private readonly queue: QueuedCommand[] = [];
  private inFlight: QueuedCommand | undefined;
  private processing = false;
  private reconnecting = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private manualDisconnect = false;
  private playerMonitor: PlayerMonitor | undefined;
  private readonly latencySamples: number[] = [];
  private metrics = {
    totalCommands: 0,
    successfulCommands: 0,
    failedCommands: 0,
    timeoutCount: 0,
    reconnectCount: 0,
    playerCount: 0,
  };

  readonly players: PlayerCommands;
  readonly server: ServerCommands;
  readonly admin: AdminCommands;
  readonly ai: AICommands;
  readonly whitelist: WhitelistCommands;
  readonly playables: PlayableCommands;

  constructor(config: RconConfig, logger?: Logger) {
    super();
    this.config = {
      host: config.host,
      port: config.port,
      password: config.password,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      reconnect: config.reconnect ?? true,
      reconnectDelayMs: config.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS,
      reconnectMaxDelayMs: config.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS,
      reconnectMultiplier: config.reconnectMultiplier ?? DEFAULT_RECONNECT_MULTIPLIER,
      reconnectMaxAttempts: config.reconnectMaxAttempts ?? 0,
      responseIdleMs: config.responseIdleMs ?? DEFAULT_RESPONSE_IDLE_MS,
      initialRequestId: config.initialRequestId ?? DEFAULT_INITIAL_REQUEST_ID,
    };
    this.nextRequestId = this.config.initialRequestId;
    this.logger = logger ?? getLogger();
    this.connection = this.createConnection();
    this.players = new PlayerCommands(this);
    this.server = new ServerCommands(this);
    this.admin = new AdminCommands(this);
    this.ai = new AICommands(this);
    this.whitelist = new WhitelistCommands(this);
    this.playables = new PlayableCommands(this);
  }

  isConnected(): boolean {
    return this.connection.isConnected();
  }

  isAuthenticated(): boolean {
    return this.authenticated && this.isConnected();
  }

  getState(): ConnectionState {
    return this.state;
  }

  async connect(): Promise<void> {
    this.manualDisconnect = false;
    if (this.isAuthenticated()) {
      return;
    }

    this.state = "connecting";
    this.logger.info(rconLogMessage(`Connecting ${this.config.host}:${this.config.port}`));

    try {
      await this.connection.connect();
      this.state = "connected";
      this.emit("connected", { host: this.config.host, port: this.config.port });
      this.logger.info(rconLogMessage(`Connected ${this.config.host}:${this.config.port}`));
      await this.authenticate();
      this.reconnectAttempt = 0;
    } catch (error) {
      this.state = "error";
      this.authenticated = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.reconnecting = false;
    this.rejectAllPending(new RconConnectionError("Disconnected by client"));
    this.authenticated = false;
    this.state = "disconnected";
    this.connection.disconnect("client_disconnect");
    this.logger.info(rconLogMessage("Disconnected"));
  }

  async reconnect(): Promise<void> {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.reconnecting = false;
    this.rejectAllPending(new RconConnectionError("Reconnecting"));
    this.connection.disconnect("reconnect");
    this.authenticated = false;
    this.manualDisconnect = false;
    this.connection = this.createConnection();
    await this.connect();
  }

  async authenticate(): Promise<void> {
    if (!this.isConnected()) {
      throw new RconConnectionError("Cannot authenticate before TCP connect");
    }

    this.state = "authenticating";
    const requestId = this.allocateRequestId();
    const packet = evrimaProtocol.encodeAuth(this.config.password);
    this.logger.info(rconLogMessage("Authenticating"));

    try {
      const response = await this.sendExclusive(requestId, packet, "auth", undefined, this.config.timeoutMs, true);
      assertAuthenticatedResponse(response.body, this.config.host, this.config.port);
      this.authenticated = true;
      this.state = "authenticated";
      this.emit("authenticated", {});
      this.logger.info(rconLogMessage("Authenticated"));
    } catch (error) {
      this.authenticated = false;
      const reason = error instanceof Error ? error.message : "authentication_failed";
      this.emit("authenticationFailed", { reason });
      this.logger.error(rconLogMessage("Authentication failed"));
      if (error instanceof RconAuthenticationError) {
        throw error;
      }
      throw new RconAuthenticationError("RCON authentication failed", {
        reason,
        host: this.config.host,
        port: this.config.port,
      });
    }
  }

  async execute(command: string, options: ExecuteOptions = {}): Promise<RconResponse> {
    const parsed = parseRawCommand(command);
    const definition = getCommandDefinition(parsed.name);
    if (!definition) {
      this.logger.warn(
        rconLogMessage(`Unverified raw command "${parsed.name}" sent via custom opcode 0x70`),
      );
      return this.executeOpcode(0x70, parsed.args, {
        ...options,
        commandName: parsed.name,
        verified: false,
      });
    }
    return this.executeOpcode(definition.opcode, parsed.args, {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: options.allowEmptyResponse ?? !definition.expectsResponse,
      verified: definition.verified,
    });
  }

  async executeOpcode(
    opcode: number,
    args = "",
    options: ExecuteOptions & { commandName?: string; verified?: boolean } = {},
  ): Promise<RconResponse> {
    if (!this.isAuthenticated()) {
      throw new RconConnectionError("RCON client is not authenticated", {
        command: options.commandName,
      });
    }

    const commandName = options.commandName ?? `opcode:0x${opcode.toString(16)}`;
    const requestId = this.allocateRequestId();
    const packet = evrimaProtocol.encodeCommand(opcode, args);
    const timeoutMs = options.timeout ?? this.config.timeoutMs;
    const allowEmptyResponse = options.allowEmptyResponse ?? false;

    this.metrics.totalCommands += 1;
    this.emit("commandSent", { requestId, command: commandName });
    this.logger.info(rconLogMessage(`${commandName} requestId=${requestId}`));

    const started = Date.now();
    try {
      const response = await this.enqueue({
        requestId,
        packet,
        command: commandName,
        opcode,
        timeoutMs,
        allowEmptyResponse,
        createdAt: started,
      });
      const latencyMs = Date.now() - started;
      this.recordLatency(latencyMs);
      this.metrics.successfulCommands += 1;
      this.emit("commandResponse", {
        requestId,
        command: commandName,
        body: response.body,
        latencyMs,
      });
      this.logger.info(rconLogMessage(`${commandName} requestId=${requestId} duration=${latencyMs}ms`));
      return response;
    } catch (error) {
      this.metrics.failedCommands += 1;
      if (error instanceof RconTimeoutError) {
        this.metrics.timeoutCount += 1;
        this.emit("timeout", { requestId, command: commandName, timeoutMs });
      }
      this.emit("error", { error: error instanceof Error ? error : new Error(String(error)) });
      throw error;
    }
  }

  async playerList(options?: ExecuteOptions): Promise<Player[]> {
    return this.players.playerList(options);
  }

  async getPlayerData(playerId?: string, options?: ExecuteOptions): Promise<Player[]> {
    return this.players.getPlayerData(playerId, options);
  }

  async kickPlayer(playerId: string, reason?: string, options?: ExecuteOptions): Promise<RconResponse> {
    const payload: KickPlayerOptions = { playerId, reason };
    return this.players.kickPlayer(payload, options);
  }

  async banPlayer(input: BanPlayerOptions | string, reason?: string, options?: ExecuteOptions): Promise<RconResponse> {
    const payload: BanPlayerOptions =
      typeof input === "string" ? { playerId: input, reason: reason ?? "" } : input;
    return this.players.banPlayer(payload, options);
  }

  async directMessage(playerId: string, message: string, options?: ExecuteOptions): Promise<RconResponse> {
    const payload: DirectMessageOptions = { playerId, message };
    return this.players.directMessage(payload, options);
  }

  async getServerDetails(options?: ExecuteOptions): Promise<ServerDetails> {
    return this.server.getServerDetails(options);
  }

  async saveServer(backupName?: string, options?: ExecuteOptions): Promise<RconResponse> {
    return this.server.saveServer(backupName, options);
  }

  async pauseServer(options?: ExecuteOptions): Promise<RconResponse> {
    return this.server.pauseServer(options);
  }

  async unpauseServer(options?: ExecuteOptions): Promise<RconResponse> {
    return this.server.unpauseServer(options);
  }

  async announce(message: string, options?: ExecuteOptions): Promise<RconResponse> {
    return this.server.announce(message, options);
  }

  async getQueueStatus(options?: ExecuteOptions): Promise<QueueStatus> {
    return this.server.getQueueStatus(options);
  }

  async getPlayables(options?: ExecuteOptions): Promise<PlayableEntry[]> {
    return this.playables.getPlayables(options);
  }

  async updatePlayables(
    playables: string[] | PlayableUpdate[],
    options?: ExecuteOptions,
  ): Promise<RconResponse> {
    return this.playables.updatePlayables(playables, options);
  }

  async addWhitelist(playerId: string | string[], options?: ExecuteOptions): Promise<RconResponse> {
    return this.whitelist.addWhitelist(playerId, options);
  }

  async removeWhitelist(playerId: string | string[], options?: ExecuteOptions): Promise<RconResponse> {
    return this.whitelist.removeWhitelist(playerId, options);
  }

  async toggleWhitelist(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    return this.whitelist.toggleWhitelist(enabled, options);
  }

  async getWhitelist(): Promise<never> {
    return this.whitelist.getWhitelist();
  }

  async toggleAI(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    return this.ai.toggleAI(enabled, options);
  }

  async setAIDensity(density: number, options?: ExecuteOptions): Promise<RconResponse> {
    return this.ai.setAIDensity(density, options);
  }

  async disableAIClasses(classes: string[], options?: ExecuteOptions): Promise<RconResponse> {
    return this.ai.disableAIClasses(classes, options);
  }

  async toggleAILearning(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    return this.ai.toggleAILearning(enabled, options);
  }

  async setGrowthMultiplier(value: number, options?: ExecuteOptions): Promise<RconResponse> {
    return this.admin.setGrowthMultiplier(value, options);
  }

  async toggleGrowthMultiplier(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    return this.admin.toggleGrowthMultiplier(enabled, options);
  }

  async toggleGlobalChat(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    return this.admin.toggleGlobalChat(enabled, options);
  }

  async toggleHumans(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    return this.admin.toggleHumans(enabled, options);
  }

  async toggleMigrations(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    return this.admin.toggleMigrations(enabled, options);
  }

  async wipeCorpses(options?: ExecuteOptions): Promise<RconResponse> {
    return this.admin.wipeCorpses(options);
  }

  async toggleNetUpdateDistanceChecks(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    return this.admin.toggleNetUpdateDistanceChecks(enabled, options);
  }

  async ping(options?: ExecuteOptions): Promise<number> {
    const started = Date.now();
    await this.getServerDetails(options);
    return Date.now() - started;
  }

  async healthCheck(options?: ExecuteOptions): Promise<HealthCheckResult> {
    if (!this.isConnected() || !this.isAuthenticated()) {
      return {
        connected: this.isConnected(),
        authenticated: this.isAuthenticated(),
        latency: null,
      };
    }
    try {
      const latency = await this.ping(options);
      return { connected: true, authenticated: true, latency };
    } catch {
      return {
        connected: this.isConnected(),
        authenticated: this.isAuthenticated(),
        latency: null,
      };
    }
  }

  getMetrics(): RconMetrics {
    const total = this.latencySamples.length;
    const averageLatencyMs =
      total === 0 ? 0 : this.latencySamples.reduce((sum, value) => sum + value, 0) / total;
    return {
      ...this.metrics,
      averageLatencyMs,
      connectionState: this.state,
      authenticated: this.isAuthenticated(),
    };
  }

  setPlayerCount(count: number): void {
    this.metrics.playerCount = count;
  }

  attachPlayerMonitor(monitor: PlayerMonitor): void {
    this.playerMonitor = monitor;
    monitor.on("playerJoined", (player) => this.emit("playerJoined", player));
    monitor.on("playerLeft", (player) => this.emit("playerLeft", player));
    monitor.on("playerChanged", (payload) => this.emit("playerChanged", payload));
  }

  getPlayerMonitor(): PlayerMonitor | undefined {
    return this.playerMonitor;
  }

  private createConnection(): RconConnection {
    const connection = new RconConnection({
      host: this.config.host,
      port: this.config.port,
      connectTimeoutMs: this.config.timeoutMs,
      responseIdleMs: this.config.responseIdleMs,
    });
    connection.onData((packet) => this.handlePacket(packet));
    connection.onClose((reason) => this.handleClose(reason));
    connection.onError((error) => this.handleSocketError(error));
    return connection;
  }

  private handlePacket(packet: DecodedPacket): void {
    const current = this.inFlight;
    if (!current) {
      this.logger.debug(rconLogMessage("Received unexpected RCON data with no in-flight request"));
      return;
    }
    this.finishInFlight({
      requestId: current.requestId,
      type: packet.type,
      body: packet.body,
      raw: packet.raw,
    });
  }

  private handleClose(reason?: string): void {
    this.authenticated = false;
    if (this.state !== "disconnected") {
      this.state = "disconnected";
      this.emit("disconnected", { reason });
      this.logger.warn(rconLogMessage(`Disconnected reason=${reason ?? "unknown"}`));
    }
    this.rejectAllPending(new RconConnectionError("Connection closed", { reason }));
    if (!this.manualDisconnect && this.config.reconnect) {
      void this.scheduleReconnect();
    }
  }

  private handleSocketError(error: Error): void {
    this.emit("error", { error });
    this.logger.error({ err: error }, rconLogMessage("Socket error"));
  }

  private enqueue(
    command: Omit<QueuedCommand, "resolve" | "reject">,
  ): Promise<RconResponse> {
    return new Promise<RconResponse>((resolve, reject) => {
      this.queue.push({ ...command, resolve, reject });
      void this.processQueue();
    });
  }

  private async sendExclusive(
    requestId: number,
    packet: Buffer,
    command: string,
    opcode: number | undefined,
    timeoutMs: number,
    allowEmptyResponse: boolean,
  ): Promise<RconResponse> {
    return this.enqueue({
      requestId,
      packet,
      command,
      opcode,
      timeoutMs,
      allowEmptyResponse,
      createdAt: Date.now(),
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.inFlight || this.queue.length === 0) {
      return;
    }
    this.processing = true;
    const next = this.queue.shift();
    if (!next) {
      this.processing = false;
      return;
    }

    this.inFlight = next;
    const timeout = setTimeout(() => {
      if (this.inFlight?.requestId !== next.requestId) {
        return;
      }
      if (next.allowEmptyResponse) {
        this.finishInFlight({
          requestId: next.requestId,
          type: 0x03,
          body: "",
        });
        return;
      }
      this.finishInFlight(
        undefined,
        new RconTimeoutError(`Command timed out after ${next.timeoutMs}ms`, {
          requestId: next.requestId,
          command: next.command,
          timeout: next.timeoutMs,
        }),
      );
    }, next.timeoutMs);

    const originalReject = next.reject;
    const originalResolve = next.resolve;
    next.reject = (error) => {
      clearTimeout(timeout);
      originalReject(error);
    };
    next.resolve = (response) => {
      clearTimeout(timeout);
      originalResolve(response);
    };

    try {
      await this.connection.write(next.packet);
    } catch (error) {
      this.finishInFlight(
        undefined,
        error instanceof Error ? error : new RconCommandError(String(error), { command: next.command }),
      );
    } finally {
      this.processing = false;
    }
  }

  private finishInFlight(response?: RconResponse, error?: Error): void {
    const current = this.inFlight;
    if (!current) {
      return;
    }
    this.inFlight = undefined;
    if (error) {
      current.reject(error);
    } else if (response) {
      current.resolve(response);
    }
    setTimeout(() => {
      void this.processQueue();
    }, this.config.responseIdleMs);
  }

  private rejectAllPending(error: Error): void {
    if (this.inFlight) {
      const current = this.inFlight;
      this.inFlight = undefined;
      current.reject(error);
    }
    while (this.queue.length > 0) {
      this.queue.shift()?.reject(error);
    }
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.reconnecting || this.manualDisconnect) {
      return;
    }
    if (
      this.config.reconnectMaxAttempts > 0
      && this.reconnectAttempt >= this.config.reconnectMaxAttempts
    ) {
      this.logger.error(rconLogMessage("Reconnect attempts exhausted"));
      return;
    }

    this.reconnecting = true;
    this.reconnectAttempt += 1;
    this.metrics.reconnectCount += 1;
    const delayMs = computeBackoffDelay(
      this.reconnectAttempt,
      this.config.reconnectDelayMs,
      this.config.reconnectMultiplier,
      this.config.reconnectMaxDelayMs,
    );
    this.state = "reconnecting";
    this.emit("reconnecting", { attempt: this.reconnectAttempt, delayMs });
    this.logger.warn(rconLogMessage(`Reconnecting attempt=${this.reconnectAttempt} delay=${delayMs}ms`));

    this.reconnectTimer = setTimeout(() => {
      void this.attemptReconnect();
    }, delayMs);
  }

  private async attemptReconnect(): Promise<void> {
    this.clearReconnectTimer();
    try {
      this.connection = this.createConnection();
      await this.connect();
      this.reconnecting = false;
    } catch (error) {
      this.reconnecting = false;
      this.logger.error(
        { err: error instanceof Error ? error.message : error },
        rconLogMessage("Reconnect failed"),
      );
      if (!this.manualDisconnect && this.config.reconnect) {
        await sleep(0);
        void this.scheduleReconnect();
      }
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private allocateRequestId(): number {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    if (this.nextRequestId > 2_147_483_647) {
      this.nextRequestId = this.config.initialRequestId;
    }
    return requestId;
  }

  private recordLatency(latencyMs: number): void {
    this.latencySamples.push(latencyMs);
    if (this.latencySamples.length > 100) {
      this.latencySamples.shift();
    }
  }
}

export function parseRawCommand(command: string): { name: string; args: string } {
  const trimmed = command.trim();
  const space = trimmed.search(/\s/);
  if (space === -1) {
    return { name: trimmed.toLowerCase(), args: "" };
  }
  return {
    name: trimmed.slice(0, space).toLowerCase(),
    args: trimmed.slice(space + 1).trim(),
  };
}
