import { spawn } from "node:child_process";
import type { Logger } from "pino";
import type { GameConfigStore } from "../config/gameConfigStore.js";
import type { ServerConfiguration } from "../config/serverConfig.js";
import { applyProcessTuning } from "../process/processTuner.js";
import type { ServerProcessManager } from "../process/ServerProcessManager.js";
import type { SteamCmdService } from "../process/SteamCmdService.js";
import type { AdminService } from "./AdminService.js";
import type { BackupService } from "./BackupService.js";
import type { ChatMonitor } from "./ChatMonitor.js";
import type { DiscordWebhookService } from "./DiscordWebhook.js";
import type { ServerService } from "./ServerService.js";

export class AutomationService {
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastActive = false;
  private startedAt = 0;
  private restartAttempts = 0;
  private intentionalStop = false;
  private nextRestartAt = 0;
  private nextBackupAt = 0;
  private nextWipeAt = 0;
  private nextSaveAt = 0;
  private nextBroadcastAt = 0;
  private lastChatPoll = 0;
  private warned = new Set<number>();
  private lastConfigKey = "";
  private pendingWipeExecuteAt = 0;

  constructor(
    private readonly store: GameConfigStore,
    private readonly process: ServerProcessManager,
    private readonly steam: SteamCmdService,
    private readonly backups: BackupService,
    private readonly discord: DiscordWebhookService,
    private readonly chat: ChatMonitor,
    private readonly server: ServerService,
    private readonly admin: AdminService,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }
    this.syncSchedule(this.store.load());
    this.timer = setInterval(() => {
      void this.tick();
    }, 15_000);
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  status(): {
    nextRestartAt: number;
    nextBackupAt: number;
    nextWipeAt: number;
    nextSaveAt: number;
    restartAttempts: number;
  } {
    return {
      nextRestartAt: this.nextRestartAt,
      nextBackupAt: this.nextBackupAt,
      nextWipeAt: this.nextWipeAt,
      nextSaveAt: this.nextSaveAt,
      restartAttempts: this.restartAttempts,
    };
  }

  markIntentionalStop(): void {
    this.intentionalStop = true;
  }

  async startServer(): Promise<void> {
    const config = this.store.load();
    if (config.validateFiles && this.steam.available) {
      await this.steam.installOrValidate(true);
    }
    this.intentionalStop = false;
    await this.process.start();
    this.startedAt = Date.now();
    this.restartAttempts = 0;
    await this.afterStart(config);
    if (config.enableDiscordWebhook) {
      void this.discord.start(config.discordWebhookUrl, config.serverName);
    }
  }

  async stopServer(): Promise<void> {
    const config = this.store.load();
    this.markIntentionalStop();
    await this.process.stop();
    if (config.enableZombieCheck) {
      await this.waitUntilStopped(config.zombieTimeoutSeconds * 1000);
      const still = await this.process.inspect();
      if (still.active) {
        await this.process.kill("SIGKILL");
      }
    }
    if (config.enableDiscordWebhook) {
      void this.discord.stop(config.discordWebhookUrl, config.serverName);
    }
  }

  async restartServer(reason = "manual"): Promise<void> {
    const config = this.store.load();
    if (config.enableDiscordWebhook) {
      void this.discord.restart(config.discordWebhookUrl, config.serverName);
    }
    this.markIntentionalStop();
    await this.process.restart();
    this.startedAt = Date.now();
    await this.afterStart(config);
    this.scheduleRestart(config);
    this.logger.info({ reason }, "[AUTO] server restarted");
  }

  private async afterStart(config: ServerConfiguration): Promise<void> {
    await sleep(4000);
    const info = await this.process.inspect();
    if (info.mainPid) {
      const notes = await applyProcessTuning(info.mainPid, config);
      if (notes.length > 0) {
        this.logger.info({ notes }, "[AUTO] process tuning");
      }
    }
    if (config.restartScriptEnabled && config.restartScriptPath) {
      const delay = Math.max(0, config.restartScriptDelaySeconds) * 1000;
      setTimeout(() => {
        runScript(config.restartScriptPath, this.logger);
      }, delay);
    }
    if (config.autoInjectAfterRestart && config.modLoaderPath) {
      const delay = Math.max(0, config.autoInjectDelaySeconds) * 1000;
      setTimeout(() => {
        runScript(config.modLoaderPath, this.logger);
      }, delay);
    }
  }

  private async tick(): Promise<void> {
    const config = this.store.load();
    this.syncSchedule(config);
    const info = await this.process.inspect();
    if (info.active && !this.lastActive) {
      this.startedAt = this.startedAt || Date.now();
      this.restartAttempts = 0;
    }
    if (this.lastActive && !info.active && !this.intentionalStop && config.enableCrashDetection) {
      const uptime = Date.now() - this.startedAt;
      this.logger.warn("[AUTO] crash detected");
      if (config.enableDiscordWebhook) {
        void this.discord.crash(config.discordWebhookUrl, config.serverName, uptime);
      }
      if (config.autoRestart && this.restartAttempts < Math.max(1, Math.min(config.maxRestartAttempts, 10))) {
        this.restartAttempts += 1;
        try {
          await this.startServer();
        } catch (error) {
          this.logger.error({ error }, "[AUTO] auto-restart failed");
        }
      }
    }
    if (info.active) {
      this.intentionalStop = false;
    }
    this.lastActive = info.active;

    const now = Date.now();
    if (config.autoBroadcastEnabled && config.autoBroadcastMessage && now >= this.nextBroadcastAt && this.nextBroadcastAt > 0 && info.active) {
      try {
        await this.server.announce(config.autoBroadcastMessage);
      } catch (error) {
        this.logger.warn({ error }, "[AUTO] broadcast failed");
      }
      this.nextBroadcastAt = now + Math.max(1, config.autoBroadcastIntervalMinutes) * 60_000;
    }
    if (config.autoRconSaveEnabled && now >= this.nextSaveAt && this.nextSaveAt > 0 && info.active) {
      try {
        await this.server.save();
      } catch (error) {
        this.logger.warn({ error }, "[AUTO] save failed");
      }
      this.nextSaveAt = now + Math.max(1, config.rconSaveIntervalMinutes) * 60_000;
    }
    if (this.pendingWipeExecuteAt > 0 && now >= this.pendingWipeExecuteAt && info.active) {
      this.pendingWipeExecuteAt = 0;
      try {
        await this.admin.wipeCorpses();
        if (config.wipeCompleteMessage) {
          await this.server.announce(config.wipeCompleteMessage);
        }
      } catch (error) {
        this.logger.warn({ error }, "[AUTO] wipe failed");
      }
      this.nextWipeAt = Date.now() + Math.max(1, config.wipeCorpsesIntervalMinutes) * 60_000;
    } else if (
      config.autoWipeCorpsesEnabled &&
      now >= this.nextWipeAt &&
      this.nextWipeAt > 0 &&
      this.pendingWipeExecuteAt === 0 &&
      info.active
    ) {
      try {
        if (config.wipeCorpsesDelayMinutes > 0) {
          await this.server.announce(
            config.wipeWarningMessage.replaceAll("{minutes}", String(config.wipeCorpsesDelayMinutes)),
          );
          this.pendingWipeExecuteAt = now + config.wipeCorpsesDelayMinutes * 60_000;
        } else {
          await this.admin.wipeCorpses();
          if (config.wipeCompleteMessage) {
            await this.server.announce(config.wipeCompleteMessage);
          }
          this.nextWipeAt = Date.now() + Math.max(1, config.wipeCorpsesIntervalMinutes) * 60_000;
        }
      } catch (error) {
        this.logger.warn({ error }, "[AUTO] wipe failed");
        this.nextWipeAt = Date.now() + Math.max(1, config.wipeCorpsesIntervalMinutes) * 60_000;
      }
    }
    if (config.autoBackupEnabled && now >= this.nextBackupAt && this.nextBackupAt > 0) {
      try {
        await this.backups.create();
        this.backups.cleanup(10);
      } catch (error) {
        this.logger.warn({ error }, "[AUTO] backup failed");
      }
      this.nextBackupAt = Date.now() + Math.max(1, config.backupIntervalHours) * 3_600_000;
    }
    if (config.scheduledRestartEnabled && this.nextRestartAt > 0) {
      const remainMin = (this.nextRestartAt - now) / 60_000;
      for (const mark of [config.restartWarningMinutes, 5, 1]) {
        if (remainMin <= mark && remainMin > mark - 0.4 && !this.warned.has(mark) && info.active) {
          this.warned.add(mark);
          try {
            await this.server.announce(config.restartMessage.replaceAll("{minutes}", String(mark)));
          } catch {
            // ignore
          }
        }
      }
      if (now >= this.nextRestartAt) {
        this.warned.clear();
        try {
          await this.restartServer("schedule");
        } catch (error) {
          this.logger.warn({ error }, "[AUTO] scheduled restart failed");
        }
      }
    }
    if (config.enableChatMonitor && now - this.lastChatPoll >= Math.max(1, config.chatRefreshInterval) * 1000) {
      this.lastChatPoll = now;
      this.chat.poll({ webhook: config.enableChatWebhook });
      if (config.enableChatWebhook) {
        const queued = this.chat.drainWebhookQueue();
        if (queued.length > 0) {
          void this.discord.chat(config.chatWebhookUrl, config.serverName, queued);
        }
      }
    }
  }

  private syncSchedule(config: ServerConfiguration): void {
    const key = [
      config.scheduledRestartEnabled,
      config.restartIntervalHours,
      config.useFixedRestartTimes,
      config.fixedRestartTimes,
      config.autoBackupEnabled,
      config.backupIntervalHours,
      config.autoWipeCorpsesEnabled,
      config.wipeCorpsesIntervalMinutes,
      config.autoRconSaveEnabled,
      config.rconSaveIntervalMinutes,
      config.autoBroadcastEnabled,
      config.autoBroadcastIntervalMinutes,
    ].join("|");
    if (key === this.lastConfigKey) {
      return;
    }
    this.lastConfigKey = key;
    this.scheduleRestart(config);
    const now = Date.now();
    this.nextBackupAt = config.autoBackupEnabled ? now + Math.max(1, config.backupIntervalHours) * 3_600_000 : 0;
    this.nextWipeAt = config.autoWipeCorpsesEnabled ? now + Math.max(1, config.wipeCorpsesIntervalMinutes) * 60_000 : 0;
    this.nextSaveAt = config.autoRconSaveEnabled ? now + Math.max(1, config.rconSaveIntervalMinutes) * 60_000 : 0;
    this.nextBroadcastAt = config.autoBroadcastEnabled ? now + Math.max(1, config.autoBroadcastIntervalMinutes) * 60_000 : 0;
  }

  private scheduleRestart(config: ServerConfiguration): void {
    this.warned.clear();
    if (!config.scheduledRestartEnabled) {
      this.nextRestartAt = 0;
      return;
    }
    if (config.useFixedRestartTimes) {
      this.nextRestartAt = nextFixedRestart(Date.now(), config.fixedRestartTimes);
      return;
    }
    this.nextRestartAt = Date.now() + Math.max(1, Math.min(config.restartIntervalHours, 24)) * 3_600_000;
  }

  private async waitUntilStopped(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const info = await this.process.inspect();
      if (!info.active) {
        return;
      }
      await sleep(2000);
    }
  }
}

export function nextFixedRestart(nowMs: number, csv: string): number {
  const times = csv
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .map((item) => {
      const match = item.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) {
        return undefined;
      }
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (hours > 23 || minutes > 59) {
        return undefined;
      }
      return hours * 60 + minutes;
    })
    .filter((item): item is number => item !== undefined)
    .sort((a, b) => a - b);
  if (times.length === 0) {
    return 0;
  }
  const now = new Date(nowMs);
  const current = now.getHours() * 60 + now.getMinutes();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const minutes of times) {
    if (minutes > current) {
      return todayStart + minutes * 60_000;
    }
  }
  return todayStart + 24 * 3_600_000 + (times[0] ?? 0) * 60_000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runScript(path: string, logger: Logger): void {
  if (!path.trim()) {
    return;
  }
  const child = spawn(path, [], { windowsHide: true, detached: true, stdio: "ignore" });
  child.unref();
  child.on("error", (error) => {
    logger.warn({ error, path }, "[AUTO] post-restart script failed");
  });
}
