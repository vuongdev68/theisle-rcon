import type { ServerConfiguration } from "./serverConfig.js";
import { DEBUG_LOG_KEYS, defaultServerConfiguration } from "./serverConfig.js";
import { KnownAIClasses } from "../commands/aiClasses.js";
import { KnownPlayables } from "../commands/playableClasses.js";
import { readBooleanField, readNumberField, readStringArrayField, readStringField } from "../web/cookies.js";

export function applySettingsPatch(current: ServerConfiguration, body: Record<string, unknown>): ServerConfiguration {
  const next: ServerConfiguration = {
    ...current,
    debugLogs: { ...current.debugLogs },
    dinosaurs: current.dinosaurs.map((item) => ({ ...item })),
    disallowedAIClasses: current.disallowedAIClasses.map((item) => ({ ...item })),
    adminSteamIds: [...current.adminSteamIds],
    whitelistIds: [...current.whitelistIds],
    vipIds: [...current.vipIds],
  };
  const str = (key: keyof ServerConfiguration, field: string): void => {
    const value = readStringField(body, field);
    if (value !== undefined) {
      (next as unknown as Record<string, unknown>)[key] = value;
    }
  };
  const flag = (key: keyof ServerConfiguration, field: string): void => {
    const value = readBooleanField(body, field);
    if (value !== undefined) {
      (next as unknown as Record<string, unknown>)[key] = value;
    }
  };
  const num = (key: keyof ServerConfiguration, field: string): void => {
    const value = readNumberField(body, field);
    if (value !== undefined) {
      (next as unknown as Record<string, unknown>)[key] = value;
    }
  };
  str("serverName", "serverName");
  str("maxPlayers", "maxPlayers");
  if (typeof body.serverPassword === "string") {
    next.serverPassword = body.serverPassword;
  }
  str("rconPassword", "rconPassword");
  str("rconPort", "rconPort");
  flag("rconEnabled", "rconEnabled");
  flag("whitelist", "whitelist");
  str("gamePort", "gamePort");
  str("queuePort", "queuePort");
  flag("queueEnabled", "queueEnabled");
  if (typeof body.customArgs === "string") {
    next.customArgs = body.customArgs;
  }
  str("dayLength", "dayLength");
  str("nightLength", "nightLength");
  flag("globalChat", "globalChat");
  flag("humans", "humans");
  flag("mutations", "mutations");
  flag("migration", "migration");
  flag("fallDamage", "fallDamage");
  str("growthMultiplier", "growthMultiplier");
  str("corpseDecay", "corpseDecay");
  str("migrationTime", "migrationTime");
  flag("spawnAI", "spawnAI");
  flag("spawnPlants", "spawnPlants");
  flag("dynamicWeather", "dynamicWeather");
  str("aiSpawnInterval", "aiSpawnInterval");
  str("aiDensity", "aiDensity");
  str("regionSpawnCooldownTimeSeconds", "regionSpawnCooldownTimeSeconds");
  flag("useRegionSpawnCooldown", "useRegionSpawnCooldown");
  flag("useRegionSpawning", "useRegionSpawning");
  str("plantSpawnMultiplier", "plantSpawnMultiplier");
  flag("allowRecordingReplay", "allowRecordingReplay");
  flag("enableDiets", "enableDiets");
  flag("enablePatrolZones", "enablePatrolZones");
  str("massMigrationTime", "massMigrationTime");
  str("massMigrationDisableTime", "massMigrationDisableTime");
  flag("enableMassMigration", "enableMassMigration");
  str("speciesMigrationTime", "speciesMigrationTime");
  str("minWeatherVariationInterval", "minWeatherVariationInterval");
  str("maxWeatherVariationInterval", "maxWeatherVariationInterval");
  str("queueJoinTimeoutSeconds", "queueJoinTimeoutSeconds");
  str("queueHeartbeatIntervalSeconds", "queueHeartbeatIntervalSeconds");
  str("queueHeartbeatTimeoutSeconds", "queueHeartbeatTimeoutSeconds");
  str("queueHeartbeatMaxMisses", "queueHeartbeatMaxMisses");
  flag("validateFiles", "validateFiles");
  flag("disableStreaming", "disableStreaming");
  const priority = readStringField(body, "processPriority");
  if (priority === "Normal" || priority === "AboveNormal" || priority === "High") {
    next.processPriority = priority;
  }
  if (typeof body.cpuAffinity === "string") {
    next.cpuAffinity = body.cpuAffinity;
  }
  flag("enableCrashDetection", "enableCrashDetection");
  flag("autoRestart", "autoRestart");
  num("maxRestartAttempts", "maxRestartAttempts");
  flag("scheduledRestartEnabled", "scheduledRestartEnabled");
  num("restartIntervalHours", "restartIntervalHours");
  num("restartWarningMinutes", "restartWarningMinutes");
  str("restartMessage", "restartMessage");
  flag("useFixedRestartTimes", "useFixedRestartTimes");
  if (typeof body.fixedRestartTimes === "string") {
    next.fixedRestartTimes = body.fixedRestartTimes;
  }
  if (typeof body.restartScriptPath === "string") {
    next.restartScriptPath = body.restartScriptPath;
  }
  num("restartScriptDelaySeconds", "restartScriptDelaySeconds");
  flag("restartScriptEnabled", "restartScriptEnabled");
  flag("enableDiscordWebhook", "enableDiscordWebhook");
  if (typeof body.discordWebhookUrl === "string") {
    next.discordWebhookUrl = body.discordWebhookUrl.trim();
  }
  if (typeof body.discordInvite === "string") {
    next.discordInvite = body.discordInvite.trim();
  }
  if (typeof body.modLoaderPath === "string") {
    next.modLoaderPath = body.modLoaderPath;
  }
  if (typeof body.modDllPath === "string") {
    next.modDllPath = body.modDllPath;
  }
  if (typeof body.modConfigDir === "string") {
    next.modConfigDir = body.modConfigDir;
  }
  flag("useModBatInjection", "useModBatInjection");
  flag("autoInjectAfterRestart", "autoInjectAfterRestart");
  num("autoInjectDelaySeconds", "autoInjectDelaySeconds");
  flag("autoBroadcastEnabled", "autoBroadcastEnabled");
  if (typeof body.autoBroadcastMessage === "string") {
    next.autoBroadcastMessage = body.autoBroadcastMessage;
  }
  num("autoBroadcastIntervalMinutes", "autoBroadcastIntervalMinutes");
  flag("autoBackupEnabled", "autoBackupEnabled");
  num("backupIntervalHours", "backupIntervalHours");
  flag("autoWipeCorpsesEnabled", "autoWipeCorpsesEnabled");
  num("wipeCorpsesIntervalMinutes", "wipeCorpsesIntervalMinutes");
  num("wipeCorpsesDelayMinutes", "wipeCorpsesDelayMinutes");
  str("wipeWarningMessage", "wipeWarningMessage");
  str("wipeCompleteMessage", "wipeCompleteMessage");
  flag("autoRconSaveEnabled", "autoRconSaveEnabled");
  num("rconSaveIntervalMinutes", "rconSaveIntervalMinutes");
  flag("enableChatMonitor", "enableChatMonitor");
  flag("enableChatWebhook", "enableChatWebhook");
  if (typeof body.chatWebhookUrl === "string") {
    next.chatWebhookUrl = body.chatWebhookUrl.trim();
  }
  num("chatRefreshInterval", "chatRefreshInterval");
  flag("enableZombieCheck", "enableZombieCheck");
  num("zombieTimeoutSeconds", "zombieTimeoutSeconds");
  const admins = readStringArrayField(body, "adminSteamIds");
  if (admins) {
    next.adminSteamIds = admins;
  }
  const whitelist = readStringArrayField(body, "whitelistIds");
  if (whitelist) {
    next.whitelistIds = whitelist;
  }
  const vips = readStringArrayField(body, "vipIds");
  if (vips) {
    next.vipIds = vips;
  }
  if (body.debugLogs && typeof body.debugLogs === "object" && !Array.isArray(body.debugLogs)) {
    const logs = body.debugLogs as Record<string, unknown>;
    for (const key of DEBUG_LOG_KEYS) {
      const value = logs[key];
      if (typeof value === "boolean") {
        next.debugLogs[key] = value;
      }
    }
  }
  if (Array.isArray(body.dinosaurs)) {
    next.dinosaurs = body.dinosaurs
      .filter((item): item is { name: string; enabled?: boolean } => typeof item === "object" && item !== null && typeof (item as { name?: unknown }).name === "string")
      .map((item) => ({ name: item.name, enabled: item.enabled !== false }));
  }
  if (Array.isArray(body.disallowedAIClasses)) {
    next.disallowedAIClasses = body.disallowedAIClasses
      .filter((item): item is { name: string; enabled?: boolean } => typeof item === "object" && item !== null && typeof (item as { name?: unknown }).name === "string")
      .map((item) => ({ name: item.name, enabled: item.enabled === true }));
  }
  return next;
}

export function blankSettings(): ServerConfiguration {
  return defaultServerConfiguration([...KnownPlayables], KnownAIClasses.map((item) => item.name));
}
