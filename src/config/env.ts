import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  loadDotenv({ path: envPath });
}

function readString(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
}

function readNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }
  return parsed;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  throw new Error(`Environment variable ${name} must be a boolean`);
}

export interface AppConfig {
  rcon: {
    host: string;
    port: number;
    password: string;
    timeoutMs: number;
    reconnect: boolean;
    reconnectDelayMs: number;
    reconnectMaxDelayMs: number;
    reconnectMultiplier: number;
    reconnectMaxAttempts: number;
    responseIdleMs: number;
  };
  playerMonitor: {
    enabled: boolean;
    pollIntervalMs: number;
  };
  log: {
    level: string;
    pretty: boolean;
  };
  systemdUnit: string;
  serverDir: string;
  steamCmdPath: string;
  web: {
    enabled: boolean;
    host: string;
    port: number;
    username: string;
    password: string;
    sessionTtlMs: number;
    rateLimitMax: number;
    rateLimitWindowMs: number;
    loginRateLimitMax: number;
  };
}

export function loadConfig(): AppConfig {
  return {
    rcon: {
      host: readString("RCON_HOST", "127.0.0.1"),
      port: readNumber("RCON_PORT", 8888),
      password: readString("RCON_PASSWORD", ""),
      timeoutMs: readNumber("RCON_TIMEOUT", 5000),
      reconnect: readBoolean("RCON_RECONNECT", true),
      reconnectDelayMs: readNumber("RCON_RECONNECT_DELAY", 1000),
      reconnectMaxDelayMs: readNumber("RCON_RECONNECT_MAX_DELAY", 30000),
      reconnectMultiplier: readNumber("RCON_RECONNECT_MULTIPLIER", 2),
      reconnectMaxAttempts: readNumber("RCON_RECONNECT_MAX_ATTEMPTS", 0),
      responseIdleMs: readNumber("RCON_RESPONSE_IDLE_MS", 150),
    },
    playerMonitor: {
      enabled: readBoolean("PLAYER_MONITOR_ENABLED", false),
      pollIntervalMs: readNumber("PLAYER_POLL_INTERVAL", 5000),
    },
    log: {
      level: readString("LOG_LEVEL", "info"),
      pretty: readBoolean("LOG_PRETTY", true),
    },
    systemdUnit: readString("SYSTEMD_UNIT", "theisle"),
    serverDir: readString("SERVER_DIR", ""),
    steamCmdPath: readString("STEAMCMD_PATH", "/usr/games/steamcmd"),
    web: {
      enabled: readBoolean("WEB_ENABLED", true),
      host: readString("WEB_HOST", "127.0.0.1"),
      port: readNumber("WEB_PORT", 3123),
      username: readString("WEB_USERNAME", "admin"),
      password: readString("WEB_PASSWORD", ""),
      sessionTtlMs: readNumber("WEB_SESSION_TTL_MS", 86_400_000),
      rateLimitMax: readNumber("WEB_RATE_LIMIT_MAX", 120),
      rateLimitWindowMs: readNumber("WEB_RATE_LIMIT_WINDOW_MS", 60_000),
      loginRateLimitMax: readNumber("WEB_LOGIN_RATE_LIMIT_MAX", 8),
    },
  };
}

export function requireRconPassword(password: string): string {
  if (!password) {
    throw new Error("RCON_PASSWORD is required and must not be empty");
  }
  return password;
}
