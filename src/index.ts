import { loadConfig, requireRconPassword } from "./config/env.js";
import { EvrimaRconClient } from "./rcon/EvrimaRconClient.js";
import { createLogger, rconLogMessage, setLogger } from "./utils/logger.js";
import { sleep } from "./utils/retry.js";
import { PlayerMonitor } from "./services/PlayerMonitor.js";
import { PlayerService } from "./services/PlayerService.js";
import { ServerService } from "./services/ServerService.js";
import { AdminService } from "./services/AdminService.js";
import { WhitelistService } from "./services/WhitelistService.js";
import { MonitoringService } from "./services/MonitoringService.js";
import { ServerProcessManager } from "./process/ServerProcessManager.js";
import { ServerLogMonitor } from "./process/ServerLogMonitor.js";
import { SteamCmdService } from "./process/SteamCmdService.js";
import { GameConfigStore } from "./config/gameConfigStore.js";
import { BackupService } from "./services/BackupService.js";
import { DiscordWebhookService } from "./services/DiscordWebhook.js";
import { ChatMonitor } from "./services/ChatMonitor.js";
import { AutomationService } from "./services/AutomationService.js";
import { startWebServer } from "./web/createWebServer.js";

export { EvrimaRconClient } from "./rcon/EvrimaRconClient.js";
export { EvrimaRconProtocol, evrimaProtocol } from "./rcon/EvrimaRconProtocol.js";
export { RconPacket } from "./rcon/RconPacket.js";
export { RconParser } from "./rcon/RconParser.js";
export { RconConnection } from "./rcon/RconConnection.js";
export {
  RconError,
  RconConnectionError,
  RconAuthenticationError,
  RconTimeoutError,
  RconProtocolError,
  RconCommandError,
  RconUnsupportedCommandError,
} from "./rcon/RconErrors.js";
export type {
  RconConfig,
  RconResponse,
  Player,
  ServerDetails,
  HealthCheckResult,
  RconMetrics,
  ExecuteOptions,
} from "./rcon/RconTypes.js";
export { PlayerService } from "./services/PlayerService.js";
export { ServerService } from "./services/ServerService.js";
export { AdminService } from "./services/AdminService.js";
export { WhitelistService } from "./services/WhitelistService.js";
export { MonitoringService } from "./services/MonitoringService.js";
export { PlayerMonitor } from "./services/PlayerMonitor.js";
export { ServerProcessManager } from "./process/ServerProcessManager.js";
export { ServerLogMonitor } from "./process/ServerLogMonitor.js";
export { GameConfigStore } from "./config/gameConfigStore.js";
export { parsePlayerListResponse, parsePlayerDataResponse, parseServerDetailsResponse } from "./rcon/responseParsers.js";
export { startWebServer, createWebServer } from "./web/createWebServer.js";

export interface RconManager {
  client: EvrimaRconClient;
  players: PlayerService;
  server: ServerService;
  admin: AdminService;
  whitelist: WhitelistService;
  monitoring: MonitoringService;
  processManager: ServerProcessManager;
  logMonitor: ServerLogMonitor;
  store: GameConfigStore;
  steam: SteamCmdService;
  backups: BackupService;
  discord: DiscordWebhookService;
  chat: ChatMonitor;
  automation: AutomationService;
}

export function createRconManager(): RconManager {
  const config = loadConfig();
  const logger = createLogger({ level: config.log.level, pretty: config.log.pretty });
  setLogger(logger);

  const client = new EvrimaRconClient(
    {
      host: config.rcon.host,
      port: config.rcon.port,
      password: requireRconPassword(config.rcon.password),
      timeoutMs: config.rcon.timeoutMs,
      reconnect: config.rcon.reconnect,
      reconnectDelayMs: config.rcon.reconnectDelayMs,
      reconnectMaxDelayMs: config.rcon.reconnectMaxDelayMs,
      reconnectMultiplier: config.rcon.reconnectMultiplier,
      reconnectMaxAttempts: config.rcon.reconnectMaxAttempts,
      responseIdleMs: config.rcon.responseIdleMs,
    },
    logger,
  );

  const playerMonitor = new PlayerMonitor(client, {
    intervalMs: config.playerMonitor.pollIntervalMs,
  });
  client.attachPlayerMonitor(playerMonitor);

  const processManager = new ServerProcessManager({ unit: config.systemdUnit, serverDir: config.serverDir });
  const logMonitor = new ServerLogMonitor({ unit: config.systemdUnit });
  const store = new GameConfigStore(config.serverDir);
  const steam = new SteamCmdService(config.serverDir, config.steamCmdPath);
  const backups = new BackupService(config.serverDir);
  const discord = new DiscordWebhookService();
  const chat = new ChatMonitor(store.logPath);
  const server = new ServerService(client, processManager);
  const admin = new AdminService(client);
  const automation = new AutomationService(store, processManager, steam, backups, discord, chat, server, admin, logger);

  return {
    client,
    players: new PlayerService(client),
    server,
    admin,
    whitelist: new WhitelistService(client),
    monitoring: new MonitoringService(client, playerMonitor, logMonitor),
    processManager,
    logMonitor,
    store,
    steam,
    backups,
    discord,
    chat,
    automation,
  };
}

export async function runDaemon(): Promise<void> {
  const config = loadConfig();
  const manager = createRconManager();
  const logger = createLogger({ level: config.log.level, pretty: config.log.pretty });

  manager.client.on("connected", ({ host, port }) => {
    logger.info(rconLogMessage(`Connected ${host}:${port}`));
  });
  manager.client.on("authenticated", () => {
    logger.info(rconLogMessage("Authenticated"));
  });
  manager.client.on("disconnected", ({ reason }) => {
    logger.warn(rconLogMessage(`Disconnected ${reason ?? ""}`.trim()));
  });
  manager.client.on("playerJoined", (player) => {
    logger.info(rconLogMessage(`playerJoined ${player.name} ${player.id}`));
  });
  manager.client.on("playerLeft", (player) => {
    logger.info(rconLogMessage(`playerLeft ${player.name} ${player.id}`));
  });

  let webApp: Awaited<ReturnType<typeof startWebServer>> | undefined;
  if (config.web.enabled) {
    manager.monitoring.startLogMonitor();
    manager.automation.start();
    if (!config.web.password) {
      logger.error("[WEB] WEB_PASSWORD is empty — admin panel not started");
    } else {
      webApp = await startWebServer({ manager, config, logger });
    }
  }

  void (async () => {
    let attempt = 0;
    while (!manager.client.isAuthenticated()) {
      attempt += 1;
      try {
        await manager.client.connect();
        if (config.playerMonitor.enabled || config.web.enabled) {
          manager.monitoring.startPlayerMonitor();
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(rconLogMessage(`Connect failed (attempt ${attempt}): ${message}`));
        await sleep(Math.min(30_000, 2000 * attempt));
      }
    }
  })();

  const shutdown = async (): Promise<void> => {
    logger.info(rconLogMessage("Shutting down"));
    manager.monitoring.stopPlayerMonitor();
    manager.monitoring.stopLogMonitor();
    manager.automation.stop();
    if (webApp) {
      await webApp.close();
    }
    await manager.client.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

function shouldRunDaemon(): boolean {
  if (process.env.pm_id !== undefined) {
    return true;
  }
  const entry = process.argv[1] ?? "";
  return entry.endsWith("index.js") || entry.endsWith("index.ts");
}

if (shouldRunDaemon()) {
  void runDaemon().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
