import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { KnownAIClasses } from "../commands/aiClasses.js";
import { KnownPlayables } from "../commands/playableClasses.js";
import {
  SESSION_SECTION,
  STATE_SECTION,
  aiClassPattern,
  classNamePattern,
  getBoolValue,
  getConfigValue,
  preservedEntries,
  readAiList,
  readClassList,
  readIdList,
  steamIdPattern,
  updateIniList,
  updateIniValue,
} from "../ini/ueIni.js";
import {
  DEBUG_LOG_KEYS,
  defaultServerConfiguration,
  type DebugLogKey,
  type NamedToggle,
  type ServerConfiguration,
} from "./serverConfig.js";

const EOS_CLIENT_ID = "xyza7891gk5PRo3J7G9puCJGFJjmEguW";
const EOS_CLIENT_SECRET = "pKWl6t5i9NJK8gTpVlAxzENZ65P8hYzodV8Dqe5Rlc8";

export class GameConfigStore {
  constructor(private readonly serverDir: string) {}

  get enabled(): boolean {
    return this.serverDir.trim().length > 0;
  }

  get savedDir(): string {
    return join(this.serverDir, "TheIsle", "Saved");
  }

  get backupDir(): string {
    return join(this.serverDir, "Backups");
  }

  get logPath(): string {
    return join(this.savedDir, "Logs", "TheIsle.log");
  }

  configDir(): string {
    const linux = join(this.serverDir, "TheIsle", "Saved", "Config", "LinuxServer");
    const windows = join(this.serverDir, "TheIsle", "Saved", "Config", "WindowsServer");
    if (existsSync(join(windows, "Game.ini")) && !existsSync(join(linux, "Game.ini"))) {
      return windows;
    }
    return linux;
  }

  gameIniPath(): string {
    return join(this.configDir(), "Game.ini");
  }

  engineIniPath(): string {
    return join(this.configDir(), "Engine.ini");
  }

  settingsPath(): string {
    return join(this.serverDir, "launcher_settings.ini");
  }

  load(): ServerConfiguration {
    const config = defaultServerConfiguration([...KnownPlayables], KnownAIClasses.map((item) => item.name));
    if (!this.enabled) {
      return config;
    }
    const gamePath = this.gameIniPath();
    if (!existsSync(gamePath)) {
      this.writeDefaultGameIni();
    }
    if (existsSync(gamePath)) {
      this.applyGameIni(config, readFileSync(gamePath, "utf8"));
    }
    if (existsSync(this.engineIniPath())) {
      this.applyEngineIni(config, readFileSync(this.engineIniPath(), "utf8"));
    }
    if (existsSync(this.settingsPath())) {
      this.applyLauncherSettings(config, readFileSync(this.settingsPath(), "utf8"));
    }
    return config;
  }

  save(config: ServerConfiguration): void {
    if (!this.enabled) {
      throw new Error("SERVER_DIR is not set");
    }
    this.writeGameIni(config);
    this.writeEngineIni(config);
    this.writeLauncherSettings(config);
  }

  private writeDefaultGameIni(): void {
    const path = this.gameIniPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `[${SESSION_SECTION}]\nServerName=My Amazing Server\nbQueueEnabled=false\n`);
  }

  private applyGameIni(config: ServerConfiguration, content: string): void {
    const scalar = (key: string, fallback: string): string => getConfigValue(content, key, SESSION_SECTION) ?? fallback;
    const flag = (key: string, fallback = false): boolean => getBoolValue(content, key, SESSION_SECTION, fallback);

    config.serverName = scalar("ServerName", config.serverName);
    config.maxPlayers = scalar("MaxPlayerCount", config.maxPlayers);
    config.serverPassword = (getConfigValue(content, "ServerPassword", SESSION_SECTION) ?? "").replaceAll('"', "");
    config.rconPassword = (getConfigValue(content, "RconPassword", SESSION_SECTION) ?? config.rconPassword).replaceAll('"', "");
    config.rconPort = scalar("RconPort", config.rconPort);
    config.rconEnabled = flag("bRconEnabled", config.rconEnabled);
    config.whitelist = flag("bServerWhitelist");
    config.queuePort = scalar("QueuePort", config.queuePort);
    config.queueEnabled = flag("bQueueEnabled");
    config.dayLength = scalar("ServerDayLengthMinutes", config.dayLength);
    config.nightLength = scalar("ServerNightLengthMinutes", config.nightLength);
    config.globalChat = flag("bEnableGlobalChat") || flag("bServerGlobalChat");
    config.humans = flag("bEnableHumans");
    config.mutations = flag("bEnableMutations");
    config.migration = flag("bEnableMigration");
    config.fallDamage = flag("bServerFallDamage");
    config.growthMultiplier = scalar("GrowthMultiplier", config.growthMultiplier);
    config.corpseDecay = scalar("CorpseDecayMultiplier", config.corpseDecay);
    config.migrationTime = scalar("MaxMigrationTime", config.migrationTime);
    config.spawnAI = flag("bSpawnAI");
    config.spawnPlants = flag("bSpawnPlants");
    config.dynamicWeather = flag("bServerDynamicWeather");
    config.aiSpawnInterval = scalar("AISpawnInterval", config.aiSpawnInterval);
    config.aiDensity = scalar("AIDensity", config.aiDensity);
    config.discordInvite = getConfigValue(content, "Discord", SESSION_SECTION) ?? "";
    config.regionSpawnCooldownTimeSeconds = scalar("RegionSpawnCooldownTimeSeconds", config.regionSpawnCooldownTimeSeconds);
    config.useRegionSpawnCooldown = flag("bUseRegionSpawnCooldown");
    config.useRegionSpawning = flag("bUseRegionSpawning");
    config.plantSpawnMultiplier = scalar("PlantSpawnMultiplier", config.plantSpawnMultiplier);
    config.allowRecordingReplay = flag("bAllowRecordingReplay", true);
    config.enableDiets = flag("bEnableDiets", true);
    config.enablePatrolZones = flag("bEnablePatrolZones", true);
    config.massMigrationTime = scalar("MassMigrationTime", config.massMigrationTime);
    config.massMigrationDisableTime = scalar("MassMigrationDisableTime", config.massMigrationDisableTime);
    config.enableMassMigration = flag("bEnableMassMigration");
    config.speciesMigrationTime = scalar("SpeciesMigrationTime", config.speciesMigrationTime);
    config.minWeatherVariationInterval = scalar("MinWeatherVariationInterval", config.minWeatherVariationInterval);
    config.maxWeatherVariationInterval = scalar("MaxWeatherVariationInterval", config.maxWeatherVariationInterval);
    config.queueJoinTimeoutSeconds = scalar("QueueJoinTimeoutSeconds", config.queueJoinTimeoutSeconds);
    config.queueHeartbeatIntervalSeconds = scalar("QueueHeartbeatIntervalSeconds", config.queueHeartbeatIntervalSeconds);
    config.queueHeartbeatTimeoutSeconds = scalar("QueueHeartbeatTimeoutSeconds", config.queueHeartbeatTimeoutSeconds);
    config.queueHeartbeatMaxMisses = scalar("QueueHeartbeatMaxMisses", config.queueHeartbeatMaxMisses);
    config.adminSteamIds = readIdList(content, "AdminsSteamIDs", STATE_SECTION);
    config.whitelistIds = readIdList(content, "WhitelistIDs", STATE_SECTION);
    config.vipIds = readIdList(content, "VIPs", STATE_SECTION);

    for (const name of readAiList(content, "DisallowedAIClasses", [SESSION_SECTION, STATE_SECTION])) {
      upsertToggle(config.disallowedAIClasses, name, true);
    }
    const allowed = readClassList(content, "AllowedClasses", STATE_SECTION);
    if (allowed.length > 0) {
      for (const dino of config.dinosaurs) {
        dino.enabled = false;
      }
      for (const name of allowed) {
        upsertToggle(config.dinosaurs, name, true);
      }
    }
  }

  private applyEngineIni(config: ServerConfiguration, content: string): void {
    for (const key of DEBUG_LOG_KEYS) {
      config.debugLogs[key] = (getConfigValue(content, key, "Core.Log") ?? "").toLowerCase() === "verbose";
    }
    config.disableStreaming = getConfigValue(content, "wp.Runtime.EnableServerStreaming", "ConsoleVariables") === "0";
  }

  private applyLauncherSettings(config: ServerConfiguration, content: string): void {
    const text = (key: string, fallback: string): string => getConfigValue(content, key) ?? fallback;
    const flag = (key: string, fallback = false): boolean => getBoolValue(content, key, undefined, fallback);
    const num = (key: string, fallback: number): number => {
      const parsed = Number(getConfigValue(content, key));
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    config.validateFiles = flag("ValidateFiles");
    config.disableStreaming = flag("DisableStreaming", config.disableStreaming);
    config.processPriority = parsePriority(text("ProcessPriority", config.processPriority));
    config.cpuAffinity = text("CpuAffinity", config.cpuAffinity);
    config.gamePort = text("GamePort", config.gamePort);
    config.enableCrashDetection = flag("EnableCrashDetection", true);
    config.autoRestart = flag("AutoRestart");
    config.maxRestartAttempts = num("MaxRestartAttempts", config.maxRestartAttempts);
    config.scheduledRestartEnabled = flag("ScheduledRestartEnabled");
    config.restartIntervalHours = num("RestartIntervalHours", config.restartIntervalHours);
    config.restartWarningMinutes = num("RestartWarningMinutes", config.restartWarningMinutes);
    config.restartMessage = text("RestartMessage", config.restartMessage);
    config.useFixedRestartTimes = flag("UseFixedRestartTimes");
    config.fixedRestartTimes = text("FixedRestartTimes", config.fixedRestartTimes);
    config.restartScriptPath = text("RestartScriptPath", config.restartScriptPath);
    config.restartScriptDelaySeconds = num("RestartScriptDelaySeconds", config.restartScriptDelaySeconds);
    config.restartScriptEnabled = flag("RestartScriptEnabled");
    config.enableDiscordWebhook = flag("EnableDiscordWebhook");
    config.discordWebhookUrl = text("DiscordWebhookUrl", config.discordWebhookUrl);
    config.modLoaderPath = text("ModLoaderPath", config.modLoaderPath);
    config.modDllPath = text("ModDllPath", config.modDllPath);
    config.modConfigDir = text("ModConfigDir", config.modConfigDir);
    config.useModBatInjection = flag("UseModBatInjection");
    config.autoInjectAfterRestart = flag("AutoInjectAfterRestart");
    config.autoInjectDelaySeconds = num("AutoInjectDelaySeconds", config.autoInjectDelaySeconds);
    config.autoBroadcastEnabled = flag("AutoBroadcastEnabled");
    config.autoBroadcastMessage = text("AutoBroadcastMessage", config.autoBroadcastMessage);
    config.autoBroadcastIntervalMinutes = num("AutoBroadcastIntervalMinutes", config.autoBroadcastIntervalMinutes);
    config.autoBackupEnabled = flag("AutoBackupEnabled");
    config.backupIntervalHours = num("BackupIntervalHours", config.backupIntervalHours);
    config.autoWipeCorpsesEnabled = flag("AutoWipeCorpsesEnabled");
    config.wipeCorpsesIntervalMinutes = num("WipeCorpsesIntervalMinutes", config.wipeCorpsesIntervalMinutes);
    config.wipeCorpsesDelayMinutes = num("WipeCorpsesDelayMinutes", config.wipeCorpsesDelayMinutes);
    config.wipeWarningMessage = text("WipeWarningMessage", config.wipeWarningMessage);
    config.wipeCompleteMessage = text("WipeCompleteMessage", config.wipeCompleteMessage);
    config.autoRconSaveEnabled = flag("AutoRconSaveEnabled");
    config.rconSaveIntervalMinutes = num("RconSaveIntervalMinutes", config.rconSaveIntervalMinutes);
    config.enableChatMonitor = flag("EnableChatMonitor");
    config.enableChatWebhook = flag("EnableChatWebhook");
    config.chatWebhookUrl = text("ChatWebhookUrl", config.chatWebhookUrl);
    config.chatRefreshInterval = num("ChatRefreshInterval", config.chatRefreshInterval);
    config.enableZombieCheck = flag("EnableZombieCheck");
    config.zombieTimeoutSeconds = num("ZombieTimeoutSeconds", config.zombieTimeoutSeconds);
    const custom = text("CustomArgs", "");
    config.customArgs = custom.startsWith("Example:") ? "" : custom;
    for (const key of DEBUG_LOG_KEYS) {
      config.debugLogs[key] = flag(`Enable${key}Verbose`, config.debugLogs[key]);
    }
    const knownDinos = text("KnownDinos", "");
    if (knownDinos) {
      for (const name of knownDinos.split(",").map((item) => item.trim()).filter(Boolean)) {
        ensureToggle(config.dinosaurs, name);
      }
    }
    const enabledDinos = getConfigValue(content, "EnabledDinos");
    if (enabledDinos !== undefined) {
      const enabled = new Set(enabledDinos.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean));
      for (const dino of config.dinosaurs) {
        dino.enabled = enabled.has(dino.name.toLowerCase());
      }
    }
    const knownAi = text("KnownAi", "");
    if (knownAi) {
      for (const name of knownAi.split(",").map((item) => item.trim()).filter(Boolean)) {
        ensureToggle(config.disallowedAIClasses, name);
      }
    }
  }

  private writeGameIni(config: ServerConfiguration): void {
    const path = this.gameIniPath();
    mkdirSync(dirname(path), { recursive: true });
    const lines = existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/) : [];
    const section = SESSION_SECTION;
    const bool = (value: boolean): string => (value ? "true" : "false");
    updateIniValue(lines, section, "ServerName", config.serverName);
    updateIniValue(lines, section, "MaxPlayerCount", config.maxPlayers);
    updateIniValue(lines, section, "MapName", "Gateway");
    const hasPass = config.serverPassword.trim().length > 0;
    updateIniValue(lines, section, "bServerPassword", bool(hasPass));
    updateIniValue(lines, section, "ServerPassword", hasPass ? config.serverPassword : undefined);
    updateIniValue(lines, section, "bRconEnabled", bool(config.rconEnabled));
    updateIniValue(lines, section, "RconPassword", config.rconPassword);
    updateIniValue(lines, section, "RconPort", config.rconPort);
    updateIniValue(lines, section, "bServerWhitelist", bool(config.whitelist));
    updateIniValue(lines, section, "bQueueEnabled", bool(config.queueEnabled));
    updateIniValue(lines, section, "QueuePort", config.queuePort);
    updateIniValue(lines, section, "bEnableHumans", bool(config.humans));
    updateIniValue(lines, section, "bEnableMutations", bool(config.mutations));
    updateIniValue(lines, section, "bEnableGlobalChat", bool(config.globalChat));
    updateIniValue(lines, section, "bServerGlobalChat", undefined);
    updateIniValue(lines, section, "bEnableMigration", bool(config.migration));
    updateIniValue(lines, section, "bServerFallDamage", bool(config.fallDamage));
    updateIniValue(lines, section, "GrowthMultiplier", config.growthMultiplier);
    updateIniValue(lines, section, "CorpseDecayMultiplier", config.corpseDecay);
    updateIniValue(lines, section, "ServerDayLengthMinutes", config.dayLength);
    updateIniValue(lines, section, "ServerNightLengthMinutes", config.nightLength);
    updateIniValue(lines, section, "MaxMigrationTime", config.migrationTime);
    updateIniValue(lines, section, "bSpawnAI", bool(config.spawnAI));
    updateIniValue(lines, section, "bSpawnPlants", bool(config.spawnPlants));
    updateIniValue(lines, section, "bServerDynamicWeather", bool(config.dynamicWeather));
    updateIniValue(lines, section, "AISpawnInterval", config.aiSpawnInterval);
    updateIniValue(lines, section, "AIDensity", config.aiDensity);
    updateIniValue(lines, section, "Discord", config.discordInvite.trim() || undefined);
    updateIniValue(lines, section, "RegionSpawnCooldownTimeSeconds", config.regionSpawnCooldownTimeSeconds);
    updateIniValue(lines, section, "bUseRegionSpawnCooldown", bool(config.useRegionSpawnCooldown));
    updateIniValue(lines, section, "bUseRegionSpawning", bool(config.useRegionSpawning));
    updateIniValue(lines, section, "PlantSpawnMultiplier", config.plantSpawnMultiplier);
    updateIniValue(lines, section, "bAllowRecordingReplay", bool(config.allowRecordingReplay));
    updateIniValue(lines, section, "bEnableDiets", bool(config.enableDiets));
    updateIniValue(lines, section, "bEnablePatrolZones", bool(config.enablePatrolZones));
    updateIniValue(lines, section, "MassMigrationTime", config.massMigrationTime);
    updateIniValue(lines, section, "MassMigrationDisableTime", config.massMigrationDisableTime);
    updateIniValue(lines, section, "bEnableMassMigration", bool(config.enableMassMigration));
    updateIniValue(lines, section, "SpeciesMigrationTime", config.speciesMigrationTime);
    updateIniValue(lines, section, "MinWeatherVariationInterval", config.minWeatherVariationInterval);
    updateIniValue(lines, section, "MaxWeatherVariationInterval", config.maxWeatherVariationInterval);
    updateIniValue(lines, section, "QueueJoinTimeoutSeconds", config.queueJoinTimeoutSeconds);
    updateIniValue(lines, section, "QueueHeartbeatIntervalSeconds", config.queueHeartbeatIntervalSeconds);
    updateIniValue(lines, section, "QueueHeartbeatTimeoutSeconds", config.queueHeartbeatTimeoutSeconds);
    updateIniValue(lines, section, "QueueHeartbeatMaxMisses", config.queueHeartbeatMaxMisses);

    const existing = lines.join("\n");
    const adminList = [
      ...config.adminSteamIds.filter(Boolean).map((id) => `AdminsSteamIDs=${id.trim()}`),
      ...preservedEntries(existing, "AdminsSteamIDs", [STATE_SECTION], steamIdPattern),
    ];
    const whitelistList = [
      ...config.whitelistIds.filter(Boolean).map((id) => `WhitelistIDs=${id.trim()}`),
      ...preservedEntries(existing, "WhitelistIDs", [STATE_SECTION], steamIdPattern),
    ];
    const vipList = [
      ...config.vipIds.filter(Boolean).map((id) => `VIPs=${id.trim()}`),
      ...preservedEntries(existing, "VIPs", [STATE_SECTION], steamIdPattern),
    ];
    const dinoList = [
      ...config.dinosaurs.filter((item) => item.enabled).map((item) => `AllowedClasses=${item.name}`),
      ...preservedEntries(existing, "AllowedClasses", [STATE_SECTION], classNamePattern),
    ];
    const aiList = [
      ...config.disallowedAIClasses.filter((item) => item.enabled).map((item) => `DisallowedAIClasses=${item.name}`),
      ...preservedEntries(existing, "DisallowedAIClasses", [SESSION_SECTION, STATE_SECTION], aiClassPattern),
    ];
    updateIniList(lines, STATE_SECTION, "AdminsSteamIDs", adminList);
    updateIniList(lines, STATE_SECTION, "WhitelistIDs", whitelistList);
    updateIniList(lines, STATE_SECTION, "VIPs", vipList);
    updateIniList(lines, STATE_SECTION, "AllowedClasses", dinoList);
    updateIniList(lines, SESSION_SECTION, "DisallowedAIClasses", aiList);
    updateIniList(lines, STATE_SECTION, "DisallowedAIClasses", []);
    writeFileSync(path, `${lines.join("\n")}\n`);
  }

  private writeEngineIni(config: ServerConfiguration): void {
    const path = this.engineIniPath();
    mkdirSync(dirname(path), { recursive: true });
    const lines = existsSync(path) ? readFileSync(path, "utf8").split(/\r?\n/) : [];
    for (const key of DEBUG_LOG_KEYS) {
      updateIniValue(lines, "Core.Log", key, config.debugLogs[key] ? "Verbose" : undefined);
    }
    updateIniValue(lines, "EpicOnlineServices", "DedicatedServerClientId", EOS_CLIENT_ID);
    updateIniValue(lines, "EpicOnlineServices", "DedicatedServerClientSecret", EOS_CLIENT_SECRET);
    updateIniValue(lines, "ConsoleVariables", "wp.Runtime.EnableServerStreaming", config.disableStreaming ? "0" : undefined);
    updateIniValue(lines, "ConsoleVariables", "wp.Runtime.EnableServerStreamingOut", config.disableStreaming ? "0" : undefined);
    writeFileSync(path, `${lines.join("\n")}\n`);
  }

  private writeLauncherSettings(config: ServerConfiguration): void {
    mkdirSync(dirname(this.settingsPath()), { recursive: true });
    const flag = (value: boolean): string => (value ? "true" : "false");
    const lines = [
      `ValidateFiles=${flag(config.validateFiles)}`,
      `DisableStreaming=${flag(config.disableStreaming)}`,
      `CustomArgs=${config.customArgs}`,
      `ProcessPriority=${config.processPriority}`,
      `CpuAffinity=${config.cpuAffinity}`,
      `GamePort=${config.gamePort}`,
      `EnableCrashDetection=${flag(config.enableCrashDetection)}`,
      `AutoRestart=${flag(config.autoRestart)}`,
      `MaxRestartAttempts=${config.maxRestartAttempts}`,
      `ScheduledRestartEnabled=${flag(config.scheduledRestartEnabled)}`,
      `RestartIntervalHours=${config.restartIntervalHours}`,
      `RestartWarningMinutes=${config.restartWarningMinutes}`,
      `RestartMessage=${config.restartMessage}`,
      `UseFixedRestartTimes=${flag(config.useFixedRestartTimes)}`,
      `FixedRestartTimes=${config.fixedRestartTimes}`,
      `RestartScriptPath=${config.restartScriptPath}`,
      `RestartScriptDelaySeconds=${config.restartScriptDelaySeconds}`,
      `RestartScriptEnabled=${flag(config.restartScriptEnabled)}`,
      `EnableDiscordWebhook=${flag(config.enableDiscordWebhook)}`,
      `DiscordWebhookUrl=${config.discordWebhookUrl}`,
      `ModLoaderPath=${config.modLoaderPath}`,
      `ModDllPath=${config.modDllPath}`,
      `ModConfigDir=${config.modConfigDir}`,
      `UseModBatInjection=${flag(config.useModBatInjection)}`,
      `AutoInjectAfterRestart=${flag(config.autoInjectAfterRestart)}`,
      `AutoInjectDelaySeconds=${config.autoInjectDelaySeconds}`,
      `AutoBroadcastEnabled=${flag(config.autoBroadcastEnabled)}`,
      `AutoBroadcastMessage=${config.autoBroadcastMessage}`,
      `AutoBroadcastIntervalMinutes=${config.autoBroadcastIntervalMinutes}`,
      `AutoBackupEnabled=${flag(config.autoBackupEnabled)}`,
      `BackupIntervalHours=${config.backupIntervalHours}`,
      `AutoWipeCorpsesEnabled=${flag(config.autoWipeCorpsesEnabled)}`,
      `WipeCorpsesIntervalMinutes=${config.wipeCorpsesIntervalMinutes}`,
      `WipeCorpsesDelayMinutes=${config.wipeCorpsesDelayMinutes}`,
      `WipeWarningMessage=${config.wipeWarningMessage}`,
      `WipeCompleteMessage=${config.wipeCompleteMessage}`,
      `AutoRconSaveEnabled=${flag(config.autoRconSaveEnabled)}`,
      `RconSaveIntervalMinutes=${config.rconSaveIntervalMinutes}`,
      `EnableChatMonitor=${flag(config.enableChatMonitor)}`,
      `EnableChatWebhook=${flag(config.enableChatWebhook)}`,
      `ChatWebhookUrl=${config.chatWebhookUrl}`,
      `ChatRefreshInterval=${config.chatRefreshInterval}`,
      `EnableZombieCheck=${flag(config.enableZombieCheck)}`,
      `ZombieTimeoutSeconds=${config.zombieTimeoutSeconds}`,
      ...DEBUG_LOG_KEYS.map((key) => `Enable${key}Verbose=${flag(config.debugLogs[key])}`),
      `EnabledDinos=${config.dinosaurs.filter((item) => item.enabled).map((item) => item.name).join(",")}`,
      `KnownDinos=${config.dinosaurs.map((item) => item.name).join(",")}`,
      `KnownAi=${config.disallowedAIClasses.map((item) => item.name).join(",")}`,
    ];
    writeFileSync(this.settingsPath(), `${lines.join("\n")}\n`);
  }
}

function upsertToggle(list: NamedToggle[], name: string, enabled: boolean): void {
  const existing = list.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.enabled = enabled;
    return;
  }
  list.push({ name, enabled });
}

function ensureToggle(list: NamedToggle[], name: string): void {
  if (list.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    return;
  }
  list.push({ name, enabled: false });
}

function parsePriority(value: string): ServerConfiguration["processPriority"] {
  if (value === "AboveNormal" || value === "High") {
    return value;
  }
  return "Normal";
}

export function isDebugLogKey(value: string): value is DebugLogKey {
  return (DEBUG_LOG_KEYS as readonly string[]).includes(value);
}
