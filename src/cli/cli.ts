#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig, requireRconPassword } from "../config/env.js";
import { EvrimaRconClient } from "../rcon/EvrimaRconClient.js";
import { createLogger, rconLogMessage } from "../utils/logger.js";
import { listVerifiedCommands } from "../commands/commandRegistry.js";
import { isRconError } from "../rcon/RconErrors.js";

const HELP = `
Evrima RCON CLI

Interactive:
  npm run cli

One-shot:
  node dist/cli/cli.js playerlist
  node dist/cli/cli.js serverdetails
  node dist/cli/cli.js announce "Server restarting soon"

Commands:
  connect
  disconnect
  status
  playerlist
  getplayerdata [playerId]
  serverdetails
  announce <message>
  directmessage <playerId> <message>
  kick <playerId> [reason]
  ban <playerId> [reason]
  save [backupName]
  getplayables
  updateplayables <ClassA,ClassB>
  whitelist add <playerId>
  whitelist remove <playerId>
  whitelist toggle [0|1]
  ai toggle [0|1]
  ai density <value>
  ai disable <Class1,Class2>
  getqueuestatus
  pause
  unpause
  wipecorpses
  help
  exit
`.trim();

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: config.log.level, pretty: config.log.pretty });
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

  if (argv.length > 0) {
    try {
      await client.connect();
      const result = await runCommand(client, argv);
      if (result !== undefined) {
        console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
      }
      await client.disconnect();
      return;
    } catch (error) {
      printError(error);
      await client.disconnect().catch(() => undefined);
      process.exitCode = 1;
      return;
    }
  }

  const rl = readline.createInterface({ input, output });
  console.log(HELP);
  let running = true;
  while (running) {
    const line = (await rl.question("rcon> ")).trim();
    if (!line) {
      continue;
    }
    const args = tokenize(line);
    const command = args[0]?.toLowerCase();
    if (command === "exit" || command === "quit") {
      running = false;
      break;
    }
    if (command === "help") {
      console.log(HELP);
      continue;
    }
    try {
      const result = await runCommand(client, args);
      if (result !== undefined) {
        console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
      }
    } catch (error) {
      printError(error);
    }
  }
  rl.close();
  await client.disconnect().catch(() => undefined);
}

async function runCommand(client: EvrimaRconClient, args: string[]): Promise<unknown> {
  const command = args[0]?.toLowerCase();
  if (!command) {
    return undefined;
  }

  switch (command) {
    case "connect":
      await client.connect();
      return rconLogMessage(`Connected ${client.isAuthenticated() ? "and authenticated" : ""}`.trim());
    case "disconnect":
      await client.disconnect();
      return "Disconnected";
    case "status":
      return {
        state: client.getState(),
        connected: client.isConnected(),
        authenticated: client.isAuthenticated(),
        metrics: client.getMetrics(),
        health: await client.healthCheck().catch(() => ({
          connected: client.isConnected(),
          authenticated: client.isAuthenticated(),
          latency: null,
        })),
      };
    case "playerlist":
      await ensureConnected(client);
      return client.playerList();
    case "getplayerdata":
      await ensureConnected(client);
      return client.getPlayerData(args[1]);
    case "serverdetails":
      await ensureConnected(client);
      return client.getServerDetails();
    case "announce":
      await ensureConnected(client);
      return client.announce(requiredRest(args, 1, "announce <message>"));
    case "directmessage":
      await ensureConnected(client);
      return client.directMessage(requireArg(args, 1, "playerId"), requiredRest(args, 2, "message"));
    case "kick":
      await ensureConnected(client);
      return client.kickPlayer(requireArg(args, 1, "playerId"), args.slice(2).join(" ") || undefined);
    case "ban":
      await ensureConnected(client);
      return client.banPlayer({
        playerId: requireArg(args, 1, "playerId"),
        reason: args.slice(2).join(" ") || "banned",
      });
    case "save":
      await ensureConnected(client);
      return client.saveServer(args[1]);
    case "getplayables":
      await ensureConnected(client);
      return client.getPlayables();
    case "updateplayables":
      await ensureConnected(client);
      return client.updatePlayables(requiredRest(args, 1, "ClassA,ClassB").split(",").map((value) => value.trim()));
    case "whitelist":
      return runWhitelist(client, args.slice(1));
    case "ai":
      return runAi(client, args.slice(1));
    case "getqueuestatus":
      await ensureConnected(client);
      return client.getQueueStatus();
    case "pause":
      await ensureConnected(client);
      return client.pauseServer();
    case "unpause":
      await ensureConnected(client);
      return client.unpauseServer();
    case "wipecorpses":
      await ensureConnected(client);
      return client.wipeCorpses();
    case "commands":
      return listVerifiedCommands().map((item) => ({
        name: item.name,
        opcode: `0x${item.opcode.toString(16)}`,
        verified: item.verified,
        arguments: item.argumentFormat ?? "",
      }));
    case "help":
      return HELP;
    default:
      throw new Error(`Unknown CLI command: ${command}. Type help.`);
  }
}

async function runWhitelist(client: EvrimaRconClient, args: string[]): Promise<unknown> {
  await ensureConnected(client);
  const action = args[0]?.toLowerCase();
  if (action === "add") {
    return client.addWhitelist(requireArg(args, 1, "playerId"));
  }
  if (action === "remove") {
    return client.removeWhitelist(requireArg(args, 1, "playerId"));
  }
  if (action === "toggle") {
    return client.toggleWhitelist(parseOptionalFlag(args[1]));
  }
  throw new Error("Usage: whitelist add|remove|toggle");
}

async function runAi(client: EvrimaRconClient, args: string[]): Promise<unknown> {
  await ensureConnected(client);
  const action = args[0]?.toLowerCase();
  if (action === "toggle") {
    return client.toggleAI(parseOptionalFlag(args[1]));
  }
  if (action === "density") {
    return client.setAIDensity(Number(requireArg(args, 1, "value")));
  }
  if (action === "disable") {
    return client.disableAIClasses(requiredRest(args, 1, "Class1,Class2").split(",").map((value) => value.trim()));
  }
  throw new Error("Usage: ai toggle|density|disable");
}

async function ensureConnected(client: EvrimaRconClient): Promise<void> {
  if (!client.isAuthenticated()) {
    await client.connect();
  }
}

function requireArg(args: string[], index: number, name: string): string {
  const value = args[index];
  if (!value) {
    throw new Error(`Missing argument: ${name}`);
  }
  return value;
}

function requiredRest(args: string[], from: number, name: string): string {
  const value = args.slice(from).join(" ").trim();
  if (!value) {
    throw new Error(`Missing argument: ${name}`);
  }
  return value;
}

function parseOptionalFlag(value?: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "1" || value.toLowerCase() === "true") {
    return true;
  }
  if (value === "0" || value.toLowerCase() === "false") {
    return false;
  }
  throw new Error("Flag must be 0, 1, true, or false");
}

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  const regex = /"([^"]*)"|(\S+)/g;
  let match: RegExpExecArray | null = regex.exec(line);
  while (match) {
    tokens.push(match[1] ?? match[2] ?? "");
    match = regex.exec(line);
  }
  return tokens;
}

function printError(error: unknown): void {
  if (isRconError(error)) {
    console.error(`${error.name}: ${error.message}`);
    return;
  }
  if (error instanceof Error) {
    console.error(error.message);
    return;
  }
  console.error(String(error));
}

const isMain = process.argv[1]?.includes("cli");
if (isMain) {
  void main();
}
