import pino, { type Logger, type LoggerOptions } from "pino";

const SECRET_KEYS = new Set([
  "password",
  "rcon_password",
  "rconpassword",
  "serverpassword",
  "secret",
  "token",
]);

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.toLowerCase());
}

export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item)) as T;
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = isSecretKey(key) ? "[redacted]" : redactSecrets(nested);
    }
    return output as T;
  }
  return value;
}

export interface LoggerConfig {
  level?: string;
  pretty?: boolean;
}

export function createLogger(config: LoggerConfig = {}): Logger {
  const options: LoggerOptions = {
    level: config.level ?? "info",
    redact: {
      paths: [
        "password",
        "RCON_PASSWORD",
        "*.password",
        "config.rcon.password",
        "metadata.password",
      ],
      censor: "[redacted]",
    },
    base: undefined,
  };

  if (config.pretty) {
    return pino({
      ...options,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    });
  }

  return pino(options);
}

let sharedLogger: Logger | undefined;

export function getLogger(): Logger {
  if (!sharedLogger) {
    sharedLogger = createLogger({
      level: process.env.LOG_LEVEL ?? "info",
      pretty: process.env.LOG_PRETTY !== "false",
    });
  }
  return sharedLogger;
}

export function setLogger(logger: Logger): void {
  sharedLogger = logger;
}

export function rconLogMessage(message: string): string {
  return `[RCON] ${message}`;
}
