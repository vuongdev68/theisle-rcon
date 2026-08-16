export interface NamedToggle {
  name: string;
  enabled: boolean;
}

export const DEBUG_LOG_KEYS = [
  "LogRedpointEOS",
  "LogOnline",
  "LogOnlineGame",
  "LogNet",
  "LogNetTraffic",
  "LogReplicationGraph",
  "LogTheIsle",
  "LogTheIsleAdmin",
  "LogTheIsleAI",
  "LogTheIsleAnimInstance",
  "LogTheIsleAudio",
  "LogTheIsleAuth",
  "LogTheIsleCharacter",
  "LogTheIsleCharacterMovement",
  "LogTheIsleDatabase",
  "LogTheIsleEnvironment",
  "LogTheIsleGame",
  "LogTheIsleNetwork",
  "LogTheIsleServer",
  "LogTheIslePlayerController",
  "LogTheIsleUI",
  "LogTheIsleWorld",
  "LogTheIsleJoinData",
  "LogTheIsleChatData",
  "LogTheIsleKillData",
  "LogTheIsleCommandData",
  "LogTheIsleAntiCheat",
] as const;

export type DebugLogKey = (typeof DEBUG_LOG_KEYS)[number];

export interface ServerConfiguration {
  serverName: string;
  maxPlayers: string;
  serverPassword: string;
  rconPassword: string;
  rconPort: string;
  rconEnabled: boolean;
  whitelist: boolean;
  gamePort: string;
  queuePort: string;
  queueEnabled: boolean;
  customArgs: string;
  dayLength: string;
  nightLength: string;
  globalChat: boolean;
  humans: boolean;
  mutations: boolean;
  migration: boolean;
  fallDamage: boolean;
  growthMultiplier: string;
  corpseDecay: string;
  migrationTime: string;
  spawnAI: boolean;
  spawnPlants: boolean;
  dynamicWeather: boolean;
  aiSpawnInterval: string;
  aiDensity: string;
  regionSpawnCooldownTimeSeconds: string;
  useRegionSpawnCooldown: boolean;
  useRegionSpawning: boolean;
  plantSpawnMultiplier: string;
  allowRecordingReplay: boolean;
  enableDiets: boolean;
  enablePatrolZones: boolean;
  massMigrationTime: string;
  massMigrationDisableTime: string;
  enableMassMigration: boolean;
  speciesMigrationTime: string;
  minWeatherVariationInterval: string;
  maxWeatherVariationInterval: string;
  queueJoinTimeoutSeconds: string;
  queueHeartbeatIntervalSeconds: string;
  queueHeartbeatTimeoutSeconds: string;
  queueHeartbeatMaxMisses: string;
  validateFiles: boolean;
  disableStreaming: boolean;
  processPriority: "Normal" | "AboveNormal" | "High";
  cpuAffinity: string;
  enableCrashDetection: boolean;
  autoRestart: boolean;
  maxRestartAttempts: number;
  scheduledRestartEnabled: boolean;
  restartIntervalHours: number;
  restartWarningMinutes: number;
  restartMessage: string;
  useFixedRestartTimes: boolean;
  fixedRestartTimes: string;
  restartScriptPath: string;
  restartScriptDelaySeconds: number;
  restartScriptEnabled: boolean;
  enableDiscordWebhook: boolean;
  discordWebhookUrl: string;
  discordInvite: string;
  modLoaderPath: string;
  modDllPath: string;
  modConfigDir: string;
  useModBatInjection: boolean;
  autoInjectAfterRestart: boolean;
  autoInjectDelaySeconds: number;
  autoBroadcastEnabled: boolean;
  autoBroadcastMessage: string;
  autoBroadcastIntervalMinutes: number;
  autoBackupEnabled: boolean;
  backupIntervalHours: number;
  autoWipeCorpsesEnabled: boolean;
  wipeCorpsesIntervalMinutes: number;
  wipeCorpsesDelayMinutes: number;
  wipeWarningMessage: string;
  wipeCompleteMessage: string;
  autoRconSaveEnabled: boolean;
  rconSaveIntervalMinutes: number;
  enableChatMonitor: boolean;
  enableChatWebhook: boolean;
  chatWebhookUrl: string;
  chatRefreshInterval: number;
  enableZombieCheck: boolean;
  zombieTimeoutSeconds: number;
  debugLogs: Record<DebugLogKey, boolean>;
  adminSteamIds: string[];
  whitelistIds: string[];
  vipIds: string[];
  dinosaurs: NamedToggle[];
  disallowedAIClasses: NamedToggle[];
}

export function emptyDebugLogs(): Record<DebugLogKey, boolean> {
  return Object.fromEntries(DEBUG_LOG_KEYS.map((key) => [key, false])) as Record<DebugLogKey, boolean>;
}

export function defaultServerConfiguration(dinos: string[], ai: string[]): ServerConfiguration {
  return {
    serverName: "My Amazing Server",
    maxPlayers: "100",
    serverPassword: "",
    rconPassword: "ChangeMe123",
    rconPort: "8888",
    rconEnabled: true,
    whitelist: false,
    gamePort: "7777",
    queuePort: "10000",
    queueEnabled: false,
    customArgs: "",
    dayLength: "45",
    nightLength: "20",
    globalChat: false,
    humans: false,
    mutations: false,
    migration: false,
    fallDamage: false,
    growthMultiplier: "1",
    corpseDecay: "1",
    migrationTime: "5400",
    spawnAI: false,
    spawnPlants: false,
    dynamicWeather: false,
    aiSpawnInterval: "40",
    aiDensity: "1",
    regionSpawnCooldownTimeSeconds: "30",
    useRegionSpawnCooldown: false,
    useRegionSpawning: false,
    plantSpawnMultiplier: "1",
    allowRecordingReplay: true,
    enableDiets: true,
    enablePatrolZones: true,
    massMigrationTime: "43200",
    massMigrationDisableTime: "7200",
    enableMassMigration: false,
    speciesMigrationTime: "10800",
    minWeatherVariationInterval: "600",
    maxWeatherVariationInterval: "900",
    queueJoinTimeoutSeconds: "30",
    queueHeartbeatIntervalSeconds: "8",
    queueHeartbeatTimeoutSeconds: "5",
    queueHeartbeatMaxMisses: "2",
    validateFiles: false,
    disableStreaming: false,
    processPriority: "Normal",
    cpuAffinity: "",
    enableCrashDetection: true,
    autoRestart: false,
    maxRestartAttempts: 3,
    scheduledRestartEnabled: false,
    restartIntervalHours: 6,
    restartWarningMinutes: 15,
    restartMessage: "Server will restart in {minutes} minute(s)!",
    useFixedRestartTimes: false,
    fixedRestartTimes: "",
    restartScriptPath: "",
    restartScriptDelaySeconds: 0,
    restartScriptEnabled: false,
    enableDiscordWebhook: false,
    discordWebhookUrl: "",
    discordInvite: "",
    modLoaderPath: "",
    modDllPath: "",
    modConfigDir: "",
    useModBatInjection: false,
    autoInjectAfterRestart: false,
    autoInjectDelaySeconds: 5,
    autoBroadcastEnabled: false,
    autoBroadcastMessage: "",
    autoBroadcastIntervalMinutes: 15,
    autoBackupEnabled: false,
    backupIntervalHours: 6,
    autoWipeCorpsesEnabled: false,
    wipeCorpsesIntervalMinutes: 60,
    wipeCorpsesDelayMinutes: 0,
    wipeWarningMessage: "Warning: All Corpses will be wiped in {minutes} minute(s)!",
    wipeCompleteMessage: "All Corpses have been wiped.",
    autoRconSaveEnabled: false,
    rconSaveIntervalMinutes: 30,
    enableChatMonitor: false,
    enableChatWebhook: false,
    chatWebhookUrl: "",
    chatRefreshInterval: 2,
    enableZombieCheck: false,
    zombieTimeoutSeconds: 60,
    debugLogs: emptyDebugLogs(),
    adminSteamIds: [],
    whitelistIds: [],
    vipIds: [],
    dinosaurs: dinos.map((name) => ({ name, enabled: true })),
    disallowedAIClasses: ai.map((name) => ({ name, enabled: false })),
  };
}
