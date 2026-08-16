import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";
import type { EvrimaRconClient } from "../rcon/EvrimaRconClient.js";
import type { Player, ServerDetails } from "../rcon/RconTypes.js";
import type { PlayerService } from "../services/PlayerService.js";
import type { ServerService } from "../services/ServerService.js";
import type { AdminService } from "../services/AdminService.js";
import type { WhitelistService } from "../services/WhitelistService.js";
import type { MonitoringService } from "../services/MonitoringService.js";
import type { ServerLogMonitor } from "../process/ServerLogMonitor.js";
import type { ServerProcessManager } from "../process/ServerProcessManager.js";
import type { SteamCmdService } from "../process/SteamCmdService.js";
import type { GameConfigStore } from "../config/gameConfigStore.js";
import type { AutomationService } from "../services/AutomationService.js";
import type { BackupService } from "../services/BackupService.js";
import type { ChatMonitor } from "../services/ChatMonitor.js";
import type { DiscordWebhookService } from "../services/DiscordWebhook.js";
import type { WebSession } from "./session.js";
import { SessionStore, passwordsMatch } from "./session.js";
import { AuditLog } from "./audit.js";
import { KnownAIClasses, isValidAIClassName } from "../commands/aiClasses.js";
import { mergePlayableCatalog } from "../commands/playableClasses.js";
import {
  SESSION_COOKIE,
  parseCookies,
  readBooleanField,
  readJsonObject,
  readNumberField,
  readStringField,
  serializeCookie,
} from "./cookies.js";
import { sendCaughtError, sendError } from "./httpErrors.js";
import { buildPlaySnapshot, normalizeSteamId } from "./playerView.js";
import { registerLauncherRoutes } from "./launcherRoutes.js";
import { RconOutputLog } from "./rconOutput.js";

export interface WebManager {
  client: EvrimaRconClient;
  players: PlayerService;
  server: ServerService;
  admin: AdminService;
  whitelist: WhitelistService;
  monitoring: MonitoringService;
  logMonitor: ServerLogMonitor;
  processManager: ServerProcessManager;
  store: GameConfigStore;
  automation: AutomationService;
  backups: BackupService;
  chat: ChatMonitor;
  discord: DiscordWebhookService;
  steam: SteamCmdService;
}

export interface WebServerOptions {
  manager: WebManager;
  config: AppConfig;
  logger: Logger;
}

const SESSION_COOKIE_HEADER = "set-cookie";
let activeRconOutput: RconOutputLog | undefined;

export async function createWebServer(options: WebServerOptions): Promise<FastifyInstance> {
  const { manager, config, logger } = options;
  const sessions = new SessionStore(config.web.sessionTtlMs);
  const audit = new AuditLog();
  const rconOutput = new RconOutputLog();
  activeRconOutput = rconOutput;
  const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../../public");

  const app = Fastify({
    logger: false,
    trustProxy: false,
  });

  await app.register(rateLimit, {
    max: config.web.rateLimitMax,
    timeWindow: config.web.rateLimitWindowMs,
  });

  const requireAdmin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const session = readSession(request, sessions);
    if (!session || session.role !== "admin") {
      sendError(reply, 401, "Authentication required");
      return;
    }
    (request as FastifyRequest & { session: WebSession }).session = session;
  };

  registerLauncherRoutes(
    app,
    {
      store: manager.store,
      automation: manager.automation,
      backups: manager.backups,
      chat: manager.chat,
      discord: manager.discord,
      steam: manager.steam,
      process: manager.processManager,
      client: manager.client,
      rconOutput,
      audit,
    },
    requireAdmin,
  );

  app.post(
    "/api/auth/login",
    {
      config: {
        rateLimit: {
          max: config.web.loginRateLimitMax,
          timeWindow: 60_000,
        },
      },
    },
    async (request, reply) => {
      const body = readJsonObject(request.body);
      const username = readStringField(body, "username") ?? "";
      const password = readStringField(body, "password") ?? "";
      const userOk = passwordsMatch(username, config.web.username);
      const passOk = passwordsMatch(password, config.web.password);
      if (!userOk || !passOk) {
        audit.record({
          actor: username || "unknown",
          role: "anonymous",
          action: "login",
          ip: request.ip,
          success: false,
          detail: "invalid_credentials",
        });
        logger.warn({ ip: request.ip }, "[WEB] Login failed");
        sendError(reply, 401, "Invalid username or password");
        return;
      }
      const session = sessions.create(config.web.username, "admin");
      reply.header(
        SESSION_COOKIE_HEADER,
        serializeCookie(SESSION_COOKIE, session.token, { maxAgeMs: config.web.sessionTtlMs }),
      );
      audit.record({
        actor: session.username,
        role: session.role,
        action: "login",
        ip: request.ip,
        success: true,
      });
      logger.info({ user: session.username, ip: request.ip }, "[WEB] Login");
      return { ok: true, user: { username: session.username, role: session.role } };
    },
  );

  app.post("/api/auth/logout", async (request, reply) => {
    const session = readSession(request, sessions);
    sessions.revoke(session?.token);
    reply.header(SESSION_COOKIE_HEADER, serializeCookie(SESSION_COOKIE, "", { clear: true }));
    if (session) {
      audit.record({
        actor: session.username,
        role: session.role,
        action: "logout",
        ip: request.ip,
        success: true,
      });
    }
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: requireAdmin }, async (request) => {
    const session = (request as FastifyRequest & { session: WebSession }).session;
    return { ok: true, user: { username: session.username, role: session.role } };
  });

  app.get("/api/server/status", { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const status = await manager.server.status();
      return { ok: true, status };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.get("/api/metrics", { preHandler: requireAdmin }, async () => {
    return { ok: true, metrics: manager.monitoring.getMetrics() };
  });

  app.post("/api/server/announce", { preHandler: requireAdmin }, async (request, reply) => {
    const session = (request as FastifyRequest & { session: WebSession }).session;
    const message = readStringField(readJsonObject(request.body), "message");
    if (!message) {
      sendError(reply, 400, "message is required");
      return;
    }
    try {
      const response = await manager.server.announce(message);
      audit.record({
        actor: session.username,
        role: session.role,
        action: "announce",
        ip: request.ip,
        success: true,
        detail: message,
      });
      return { ok: true, response: toPublicResponse(response) };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.post("/api/server/save", { preHandler: requireAdmin }, async (request, reply) => {
    const session = (request as FastifyRequest & { session: WebSession }).session;
    const backupName = readStringField(readJsonObject(request.body), "backupName");
    try {
      const response = await manager.server.save(backupName);
      audit.record({
        actor: session.username,
        role: session.role,
        action: "save",
        ip: request.ip,
        success: true,
        detail: backupName,
      });
      return { ok: true, response: toPublicResponse(response) };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.post("/api/server/pause", { preHandler: requireAdmin }, async (request, reply) => {
    return runAdminAction(request, reply, audit, "pause", async () => manager.server.pause());
  });

  app.post("/api/server/unpause", { preHandler: requireAdmin }, async (request, reply) => {
    return runAdminAction(request, reply, audit, "unpause", async () => manager.server.unpause());
  });

  app.post("/api/server/restart", { preHandler: requireAdmin }, async (request, reply) => {
    const session = (request as FastifyRequest & { session: WebSession }).session;
    const confirm = readBooleanField(readJsonObject(request.body), "confirm");
    if (confirm !== true) {
      sendError(reply, 400, "confirm must be true");
      return;
    }
    try {
      const result = await manager.server.restartProcess();
      audit.record({
        actor: session.username,
        role: session.role,
        action: "restart",
        ip: request.ip,
        success: result.ok,
        detail: result.output.slice(0, 500),
      });
      return { ok: true, result };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.get("/api/server/queue", { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const queue = await manager.server.queueStatus();
      return { ok: true, queue };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.get("/api/server/logs", { preHandler: requireAdmin }, async () => {
    return {
      ok: true,
      running: manager.monitoring.isLogMonitorRunning(),
      lines: manager.monitoring.getRecentLines(),
    };
  });

  app.get("/api/players", { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const players = await manager.players.list();
      return { ok: true, players };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.get("/api/players/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const player = await manager.players.getById(id);
      if (!player) {
        sendError(reply, 404, "Player not found");
        return;
      }
      return { ok: true, player };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.post("/api/players/:id/kick", { preHandler: requireAdmin }, async (request, reply) => {
    const session = (request as FastifyRequest & { session: WebSession }).session;
    const { id } = request.params as { id: string };
    const reason = readStringField(readJsonObject(request.body), "reason") ?? "kicked";
    try {
      const response = await manager.players.kick(id, reason);
      audit.record({
        actor: session.username,
        role: session.role,
        action: "kick",
        target: id,
        ip: request.ip,
        success: true,
        detail: reason,
      });
      return { ok: true, response: toPublicResponse(response) };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.post("/api/players/:id/ban", { preHandler: requireAdmin }, async (request, reply) => {
    const session = (request as FastifyRequest & { session: WebSession }).session;
    const { id } = request.params as { id: string };
    const body = readJsonObject(request.body);
    const reason = readStringField(body, "reason");
    if (!reason) {
      sendError(reply, 400, "reason is required");
      return;
    }
    const name = readStringField(body, "name");
    const durationSeconds = readNumberField(body, "durationSeconds") ?? 0;
    try {
      const response = await manager.players.ban(id, reason, {
        name,
        durationSeconds,
      });
      audit.record({
        actor: session.username,
        role: session.role,
        action: "ban",
        target: id,
        ip: request.ip,
        success: true,
        detail: `${reason}; duration=${durationSeconds}; name=${name ?? ""}`,
      });
      return { ok: true, response: toPublicResponse(response) };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.post("/api/players/:id/message", { preHandler: requireAdmin }, async (request, reply) => {
    const session = (request as FastifyRequest & { session: WebSession }).session;
    const { id } = request.params as { id: string };
    const message = readStringField(readJsonObject(request.body), "message");
    if (!message) {
      sendError(reply, 400, "message is required");
      return;
    }
    try {
      const response = await manager.players.directMessage(id, message);
      audit.record({
        actor: session.username,
        role: session.role,
        action: "directmessage",
        target: id,
        ip: request.ip,
        success: true,
      });
      return { ok: true, response: toPublicResponse(response) };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.post("/api/players/:id/slay", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return runAdminAction(request, reply, audit, "slay", async () => manager.players.slay(id), id);
  });

  app.get("/api/playables", { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const playables = mergePlayableCatalog(await manager.server.getPlayables());
      return { ok: true, playables };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.post("/api/playables", { preHandler: requireAdmin }, async (request, reply) => {
    const session = (request as FastifyRequest & { session: WebSession }).session;
    const body = readJsonObject(request.body);
    const playables = Array.isArray(body.playables)
      ? body.playables.filter((item): item is string => typeof item === "string" && item.trim() !== "")
      : undefined;
    if (!playables || playables.length === 0) {
      sendError(reply, 400, "playables must be a non-empty string array");
      return;
    }
    try {
      const response = await manager.server.updatePlayables(playables);
      audit.record({
        actor: session.username,
        role: session.role,
        action: "updateplayables",
        ip: request.ip,
        success: true,
        detail: playables.join(","),
      });
      return { ok: true, response: toPublicResponse(response) };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.post("/api/whitelist/add", { preHandler: requireAdmin }, async (request, reply) => {
    const playerId = readStringField(readJsonObject(request.body), "playerId");
    if (!playerId) {
      sendError(reply, 400, "playerId is required");
      return;
    }
    return runAdminAction(request, reply, audit, "addwhitelist", async () => manager.whitelist.add(playerId), playerId);
  });

  app.post("/api/whitelist/remove", { preHandler: requireAdmin }, async (request, reply) => {
    const playerId = readStringField(readJsonObject(request.body), "playerId");
    if (!playerId) {
      sendError(reply, 400, "playerId is required");
      return;
    }
    return runAdminAction(request, reply, audit, "removewhitelist", async () => manager.whitelist.remove(playerId), playerId);
  });

  app.post("/api/whitelist/toggle", { preHandler: requireAdmin }, async (request, reply) => {
    const enabled = readBooleanField(readJsonObject(request.body), "enabled");
    return runAdminAction(request, reply, audit, "togglewhitelist", async () => manager.whitelist.toggle(enabled));
  });

  app.post("/api/world/ai", { preHandler: requireAdmin }, async (request, reply) => {
    const enabled = readBooleanField(readJsonObject(request.body), "enabled");
    return runAdminAction(request, reply, audit, "toggleai", async () => manager.admin.toggleAI(enabled));
  });

  app.post("/api/world/ai-density", { preHandler: requireAdmin }, async (request, reply) => {
    const density = readNumberField(readJsonObject(request.body), "density");
    if (density === undefined) {
      sendError(reply, 400, "density is required");
      return;
    }
    return runAdminAction(request, reply, audit, "aidensity", async () => manager.admin.setAIDensity(density));
  });

  app.get("/api/world/ai-classes", { preHandler: requireAdmin }, async () => {
    return { ok: true, classes: KnownAIClasses };
  });

  app.post("/api/world/ai-classes", { preHandler: requireAdmin }, async (request, reply) => {
    const body = readJsonObject(request.body);
    const classes = Array.isArray(body.classes)
      ? body.classes.filter((item): item is string => typeof item === "string").map((item) => item.trim())
      : undefined;
    if (!classes) {
      sendError(reply, 400, "classes must be a string array");
      return;
    }
    const unknown = classes.filter((item) => item !== "" && !isValidAIClassName(item));
    if (unknown.length > 0) {
      sendError(reply, 400, `Unknown AI class: ${unknown.join(", ")}`);
      return;
    }
    const disabled = classes.filter((item) => item !== "");
    return runAdminAction(
      request,
      reply,
      audit,
      "disableaiclasses",
      async () => manager.admin.disableAIClasses(disabled),
    );
  });

  app.post("/api/world/growth", { preHandler: requireAdmin }, async (request, reply) => {
    const value = readNumberField(readJsonObject(request.body), "value");
    if (value === undefined) {
      sendError(reply, 400, "value is required");
      return;
    }
    return runAdminAction(request, reply, audit, "setgrowthmultiplier", async () => manager.admin.setGrowthMultiplier(value));
  });

  app.post("/api/world/growth-toggle", { preHandler: requireAdmin }, async (request, reply) => {
    const enabled = readBooleanField(readJsonObject(request.body), "enabled");
    return runAdminAction(request, reply, audit, "togglegrowthmultiplier", async () => manager.admin.toggleGrowthMultiplier(enabled));
  });

  app.post("/api/world/chat", { preHandler: requireAdmin }, async (request, reply) => {
    const enabled = readBooleanField(readJsonObject(request.body), "enabled");
    return runAdminAction(request, reply, audit, "toggleglobalchat", async () => manager.admin.toggleGlobalChat(enabled));
  });

  app.post("/api/world/humans", { preHandler: requireAdmin }, async (request, reply) => {
    const enabled = readBooleanField(readJsonObject(request.body), "enabled");
    return runAdminAction(request, reply, audit, "togglehumans", async () => manager.admin.toggleHumans(enabled));
  });

  app.post("/api/world/migrations", { preHandler: requireAdmin }, async (request, reply) => {
    const enabled = readBooleanField(readJsonObject(request.body), "enabled");
    return runAdminAction(request, reply, audit, "togglemigrations", async () => manager.admin.toggleMigrations(enabled));
  });

  app.post("/api/world/ai-learning", { preHandler: requireAdmin }, async (request, reply) => {
    const enabled = readBooleanField(readJsonObject(request.body), "enabled");
    return runAdminAction(request, reply, audit, "toggleailearning", async () => manager.admin.toggleAILearning(enabled));
  });

  app.post("/api/world/net-distance", { preHandler: requireAdmin }, async (request, reply) => {
    const enabled = readBooleanField(readJsonObject(request.body), "enabled");
    return runAdminAction(
      request,
      reply,
      audit,
      "togglenetupdatedistancechecks",
      async () => manager.admin.toggleNetUpdateDistanceChecks(enabled),
    );
  });

  app.post("/api/world/corpses", { preHandler: requireAdmin }, async (request, reply) => {
    const confirm = readBooleanField(readJsonObject(request.body), "confirm");
    if (confirm !== true) {
      sendError(reply, 400, "confirm must be true");
      return;
    }
    return runAdminAction(request, reply, audit, "wipecorpses", async () => manager.admin.wipeCorpses());
  });

  const playRouteLimit = {
    config: {
      rateLimit: {
        max: 40,
        timeWindow: "1 minute",
      },
    },
  };

  let playCache:
    | {
        at: number;
        players: Player[];
        details: ServerDetails | undefined;
        connected: boolean;
      }
    | undefined;

  const loadPlayData = async () => {
    const now = Date.now();
    if (playCache && now - playCache.at < 5_000) {
      return playCache;
    }
    try {
      const health = await manager.client.healthCheck();
      const connected = health.authenticated;
      const [players, details] = connected
        ? await Promise.all([
            manager.players.list(),
            manager.client.getServerDetails().catch(() => undefined),
          ])
        : [[], undefined];
      playCache = { at: now, players, details, connected };
      return playCache;
    } catch {
      playCache = { at: now, players: [], details: undefined, connected: false };
      return playCache;
    }
  };

  app.get("/api/play/snapshot", playRouteLimit, async (request, reply) => {
    const query = request.query as { id?: unknown };
    const rawId = typeof query.id === "string" ? query.id : undefined;
    if (rawId?.trim() && !normalizeSteamId(rawId)) {
      sendError(reply, 400, "SteamID không hợp lệ");
      return;
    }
    try {
      const data = await loadPlayData();
      return { ok: true, ...buildPlaySnapshot(data, normalizeSteamId(rawId)) };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.get("/api/audit", { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { limit?: string };
    const limit = query.limit ? Number(query.limit) : 100;
    return { ok: true, entries: audit.list(Number.isFinite(limit) ? limit : 100) };
  });

  app.get("/api/events", { preHandler: requireAdmin }, async (request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    const writeEvent = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    writeEvent("hello", { ok: true });

    const onLog = (payload: { line: string; timestamp: number }): void => {
      writeEvent("logLine", payload);
    };
    const onJoin = (player: Player): void => {
      writeEvent("playerJoined", player);
    };
    const onLeft = (player: Player): void => {
      writeEvent("playerLeft", player);
    };

    manager.logMonitor.on("logLine", onLog);
    manager.client.on("playerJoined", onJoin);
    manager.client.on("playerLeft", onLeft);

    const heartbeat = setInterval(() => {
      writeEvent("ping", { t: Date.now() });
    }, 15_000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      manager.logMonitor.off("logLine", onLog);
      manager.client.off("playerJoined", onJoin);
      manager.client.off("playerLeft", onLeft);
    });
  });

  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/",
    index: ["index.html"],
  });

  return app;
}

export async function startWebServer(options: WebServerOptions): Promise<FastifyInstance> {
  const app = await createWebServer(options);
  await app.listen({ host: options.config.web.host, port: options.config.web.port });
  options.logger.info(
    `[WEB] Admin panel http://${options.config.web.host}:${options.config.web.port} · player portal /play.html`,
  );
  return app;
}

function readSession(request: FastifyRequest, sessions: SessionStore): WebSession | undefined {
  const cookies = parseCookies(request.headers.cookie);
  return sessions.get(cookies[SESSION_COOKIE]);
}

function toPublicResponse(response: { requestId: number; type: number; body: string }) {
  return {
    requestId: response.requestId,
    type: response.type,
    body: response.body,
  };
}

async function runAdminAction(
  request: FastifyRequest,
  reply: FastifyReply,
  audit: AuditLog,
  action: string,
  run: () => Promise<unknown>,
  target?: string,
): Promise<unknown> {
  const session = (request as FastifyRequest & { session: WebSession }).session;
  try {
    const result = await run();
    audit.record({
      actor: session.username,
      role: session.role,
      action,
      target,
      ip: request.ip,
      success: true,
    });
    if (result && typeof result === "object" && "requestId" in result && "body" in result) {
      const publicResponse = toPublicResponse(result as { requestId: number; type: number; body: string });
      activeRconOutput?.push(action, publicResponse.body);
      return { ok: true, response: publicResponse };
    }
    if (result !== undefined) {
      activeRconOutput?.push(action, typeof result === "string" ? result : JSON.stringify(result).slice(0, 4000));
    }
    return { ok: true, result };
  } catch (error) {
    audit.record({
      actor: session.username,
      role: session.role,
      action,
      target,
      ip: request.ip,
      success: false,
      detail: error instanceof Error ? error.message : "error",
    });
    sendCaughtError(reply, error);
    return undefined;
  }
}
