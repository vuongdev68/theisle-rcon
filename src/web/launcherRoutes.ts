import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { cpus } from "node:os";
import { applySettingsPatch } from "../config/applySettingsPatch.js";
import type { GameConfigStore } from "../config/gameConfigStore.js";
import type { AutomationService } from "../services/AutomationService.js";
import type { BackupService } from "../services/BackupService.js";
import type { ChatMonitor } from "../services/ChatMonitor.js";
import type { DiscordWebhookService } from "../services/DiscordWebhook.js";
import type { SteamCmdService } from "../process/SteamCmdService.js";
import type { ServerProcessManager } from "../process/ServerProcessManager.js";
import type { EvrimaRconClient } from "../rcon/EvrimaRconClient.js";
import type { AuditLog } from "./audit.js";
import { readBooleanField, readJsonObject, readStringField } from "./cookies.js";
import { sendCaughtError, sendError } from "./httpErrors.js";
import type { RconOutputLog } from "./rconOutput.js";
import type { WebSession } from "./session.js";

export interface LauncherDeps {
  store: GameConfigStore;
  automation: AutomationService;
  backups: BackupService;
  chat: ChatMonitor;
  discord: DiscordWebhookService;
  steam: SteamCmdService;
  process: ServerProcessManager;
  client: EvrimaRconClient;
  rconOutput: RconOutputLog;
  audit: AuditLog;
}

type RequireAdmin = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export function registerLauncherRoutes(app: FastifyInstance, deps: LauncherDeps, requireAdmin: RequireAdmin): void {
  const { store, automation, backups, chat, discord, steam, process, client, rconOutput, audit } = deps;
  let controlJob: Promise<void> | undefined;

  const runJob = (name: string, work: () => Promise<void>): { ok: true; accepted: true } | { error: string } => {
    if (controlJob) {
      return { error: "A start/stop/install job is already running" };
    }
    controlJob = work()
      .catch((error: unknown) => {
        audit.record({
          actor: "system",
          role: "admin",
          action: name,
          success: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        controlJob = undefined;
      });
    return { ok: true, accepted: true };
  };

  app.get("/api/launcher/status", { preHandler: requireAdmin }, async () => {
    const info = await process.inspect();
    const config = store.load();
    return {
      ok: true,
      process: info,
      steam: { available: steam.available, running: steam.running, lastError: steam.lastError, lastOutput: steam.lastOutput.slice(-40) },
      busy: Boolean(controlJob),
      automation: automation.status(),
      serverDir: store.enabled,
      cpuCount: cpus().length,
      validateFiles: config.validateFiles,
    };
  });

  app.post("/api/launcher/start", { preHandler: requireAdmin }, async (request, reply) => {
    const session = (request as FastifyRequest & { session: WebSession }).session;
    const result = runJob("start", () => automation.startServer());
    if ("error" in result) {
      sendError(reply, 409, result.error);
      return;
    }
    audit.record({ actor: session.username, role: session.role, action: "start", ip: request.ip, success: true });
    return result;
  });

  app.post("/api/launcher/stop", { preHandler: requireAdmin }, async (request, reply) => {
    const session = (request as FastifyRequest & { session: WebSession }).session;
    const result = runJob("stop", () => automation.stopServer());
    if ("error" in result) {
      sendError(reply, 409, result.error);
      return;
    }
    audit.record({ actor: session.username, role: session.role, action: "stop", ip: request.ip, success: true });
    return result;
  });

  app.post("/api/launcher/restart", { preHandler: requireAdmin }, async (request, reply) => {
    const confirm = readBooleanField(readJsonObject(request.body), "confirm");
    if (confirm !== true) {
      sendError(reply, 400, "confirm must be true");
      return;
    }
    const session = (request as FastifyRequest & { session: WebSession }).session;
    const result = runJob("restart", () => automation.restartServer("manual"));
    if ("error" in result) {
      sendError(reply, 409, result.error);
      return;
    }
    audit.record({ actor: session.username, role: session.role, action: "restart", ip: request.ip, success: true });
    return result;
  });

  app.post("/api/launcher/install", { preHandler: requireAdmin }, async (request, reply) => {
    if (!steam.available) {
      sendError(reply, 400, "SteamCMD or SERVER_DIR is not configured");
      return;
    }
    const session = (request as FastifyRequest & { session: WebSession }).session;
    const result = runJob("install", async () => {
      await steam.installOrValidate(true);
    });
    if ("error" in result) {
      sendError(reply, 409, result.error);
      return;
    }
    audit.record({ actor: session.username, role: session.role, action: "install", ip: request.ip, success: true });
    return result;
  });

  app.get("/api/settings", { preHandler: requireAdmin }, async () => {
    return { ok: true, settings: store.load(), cpuCount: cpus().length, serverDirEnabled: store.enabled };
  });

  app.post("/api/settings", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const next = applySettingsPatch(store.load(), readJsonObject(request.body));
      store.save(next);
      const session = (request as FastifyRequest & { session: WebSession }).session;
      audit.record({ actor: session.username, role: session.role, action: "save-settings", ip: request.ip, success: true });
      return { ok: true, settings: next };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.get("/api/backups", { preHandler: requireAdmin }, async () => {
    return { ok: true, backups: backups.list(), folder: backups.backupDir };
  });

  app.post("/api/backups", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const backup = await backups.create();
      const session = (request as FastifyRequest & { session: WebSession }).session;
      audit.record({ actor: session.username, role: session.role, action: "backup", ip: request.ip, success: true, detail: backup.name });
      return { ok: true, backup };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.post("/api/backups/restore", { preHandler: requireAdmin }, async (request, reply) => {
    const name = readStringField(readJsonObject(request.body), "name");
    if (!name) {
      sendError(reply, 400, "name is required");
      return;
    }
    try {
      await backups.restore(name);
      const session = (request as FastifyRequest & { session: WebSession }).session;
      audit.record({ actor: session.username, role: session.role, action: "restore", ip: request.ip, success: true, detail: name });
      return { ok: true };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.get("/api/chat", { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { channels?: string };
    const channels = (query.channels ?? "Global,Local,Admin")
      .split(",")
      .map((item) => item.trim())
      .filter((item): item is "Global" | "Local" | "Admin" => item === "Global" || item === "Local" || item === "Admin");
    return { ok: true, messages: chat.getLines(channels.length ? channels : ["Global", "Local", "Admin"]) };
  });

  app.post("/api/chat/clear", { preHandler: requireAdmin }, async () => {
    chat.clear();
    return { ok: true };
  });

  app.post("/api/discord/test", { preHandler: requireAdmin }, async (request, reply) => {
    const settings = store.load();
    const url = readStringField(readJsonObject(request.body), "url") ?? settings.discordWebhookUrl;
    const ok = await discord.test(url, settings.serverName);
    if (!ok) {
      sendError(reply, 400, "Webhook test failed");
      return;
    }
    return { ok: true };
  });

  app.post("/api/rcon/test", { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const health = await client.healthCheck();
      rconOutput.push("test", JSON.stringify(health));
      return { ok: true, health };
    } catch (error) {
      sendCaughtError(reply, error);
    }
  });

  app.get("/api/rcon/output", { preHandler: requireAdmin }, async () => {
    return { ok: true, lines: rconOutput.list() };
  });

  app.post("/api/rcon/output/clear", { preHandler: requireAdmin }, async () => {
    rconOutput.clear();
    return { ok: true };
  });
}
