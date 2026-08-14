import type { CommandDefinition } from "../rcon/RconTypes.js";
import { RconUnsupportedCommandError } from "../rcon/RconErrors.js";

const SOURCE_PHP = "Theislemanager/evrima-rcon (developer opcode table)";
const SOURCE_TS = "menix1337/isle-evrima-rcon";
const SOURCE_GO = "Butt4cak3/theislercon";
const SOURCE_CSHARP = "aerond7/TheIsleEvrimaRconClient";
const SOURCE_HOSTING = "Game Host Bros Evrima RCON guide";

export const VerifiedCommands: Record<string, CommandDefinition> = {
  announce: {
    name: "announce",
    opcode: 0x10,
    verified: true,
    expectsResponse: false,
    description: "Broadcast a message to all connected players",
    argumentFormat: "message",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  directmessage: {
    name: "directmessage",
    opcode: 0x11,
    verified: true,
    expectsResponse: false,
    description: "Send a direct announcement to one player",
    argumentFormat: "playerId,message",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  serverdetails: {
    name: "serverdetails",
    opcode: 0x12,
    verified: true,
    expectsResponse: true,
    description: "Retrieve current server settings",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  wipecorpses: {
    name: "wipecorpses",
    opcode: 0x13,
    verified: true,
    expectsResponse: false,
    description: "Remove all corpses from the map",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  getplayables: {
    name: "getplayables",
    opcode: 0x14,
    verified: true,
    expectsResponse: true,
    description: "List playable dinosaur classes",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_HOSTING],
  },
  updateplayables: {
    name: "updateplayables",
    opcode: 0x15,
    verified: true,
    expectsResponse: false,
    description: "Update enabled playable classes",
    argumentFormat: "ClassA,ClassB  OR  ClassA:enabled,ClassB:disabled",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  togglemigrations: {
    name: "togglemigrations",
    opcode: 0x19,
    verified: true,
    expectsResponse: false,
    description: "Toggle species migrations",
    argumentFormat: "0|1 (optional)",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_HOSTING],
  },
  ban: {
    name: "ban",
    opcode: 0x20,
    verified: true,
    expectsResponse: false,
    description: "Ban a player",
    argumentFormat: "Name,SteamID64,Reason,Time  OR  playerId,reason",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  togglegrowthmultiplier: {
    name: "togglegrowthmultiplier",
    opcode: 0x21,
    verified: true,
    expectsResponse: false,
    description: "Toggle growth multiplier",
    argumentFormat: "0|1 (optional)",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_HOSTING],
  },
  setgrowthmultiplier: {
    name: "setgrowthmultiplier",
    opcode: 0x22,
    verified: true,
    expectsResponse: false,
    description: "Set growth multiplier value",
    argumentFormat: "value",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_HOSTING],
  },
  togglenetupdatedistancechecks: {
    name: "togglenetupdatedistancechecks",
    opcode: 0x23,
    verified: true,
    expectsResponse: false,
    description: "Toggle net update distance checks",
    argumentFormat: "0|1 (optional)",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_HOSTING],
  },
  kick: {
    name: "kick",
    opcode: 0x30,
    verified: true,
    expectsResponse: false,
    description: "Kick a player",
    argumentFormat: "playerId,reason",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  playerlist: {
    name: "playerlist",
    opcode: 0x40,
    verified: true,
    expectsResponse: true,
    description: "List connected players",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  save: {
    name: "save",
    opcode: 0x50,
    verified: true,
    expectsResponse: false,
    description: "Save world state",
    argumentFormat: "backupName (optional)",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  pause: {
    name: "pause",
    opcode: 0x60,
    verified: true,
    expectsResponse: false,
    description: "Pause or unpause the server (toggle, or 0/1)",
    argumentFormat: "0|1 (optional)",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_HOSTING],
  },
  custom: {
    name: "custom",
    opcode: 0x70,
    verified: false,
    expectsResponse: true,
    description: "Custom/raw opcode. May not be functional on all builds.",
    argumentFormat: "payload",
    sources: [SOURCE_PHP, SOURCE_TS],
  },
  getplayerdata: {
    name: "getplayerdata",
    opcode: 0x77,
    verified: true,
    expectsResponse: true,
    description: "Detailed stats for spawned players",
    argumentFormat: "playerId (optional)",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  togglewhitelist: {
    name: "togglewhitelist",
    opcode: 0x81,
    verified: true,
    expectsResponse: false,
    description: "Enable or disable whitelist",
    argumentFormat: "0|1 (optional)",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  addwhitelist: {
    name: "addwhitelist",
    opcode: 0x82,
    verified: true,
    expectsResponse: false,
    description: "Add player ID(s) to whitelist",
    argumentFormat: "playerId[,playerId...]",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  removewhitelist: {
    name: "removewhitelist",
    opcode: 0x83,
    verified: true,
    expectsResponse: false,
    description: "Remove player ID(s) from whitelist",
    argumentFormat: "playerId[,playerId...]",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  toggleglobalchat: {
    name: "toggleglobalchat",
    opcode: 0x84,
    verified: true,
    expectsResponse: false,
    description: "Toggle global chat",
    argumentFormat: "0|1 (optional)",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  togglehumans: {
    name: "togglehumans",
    opcode: 0x86,
    verified: true,
    expectsResponse: false,
    description: "Toggle humans",
    argumentFormat: "0|1 (optional)",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  toggleai: {
    name: "toggleai",
    opcode: 0x90,
    verified: true,
    expectsResponse: false,
    description: "Toggle AI spawning",
    argumentFormat: "0|1 (optional)",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  disableaiclasses: {
    name: "disableaiclasses",
    opcode: 0x91,
    verified: true,
    expectsResponse: false,
    description: "Disable listed AI classes",
    argumentFormat: "Class1,Class2",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  aidensity: {
    name: "aidensity",
    opcode: 0x92,
    verified: true,
    expectsResponse: false,
    description: "Set AI spawn density",
    argumentFormat: "0.0-1.0",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_GO, SOURCE_CSHARP, SOURCE_HOSTING],
  },
  getqueuestatus: {
    name: "getqueuestatus",
    opcode: 0x93,
    verified: true,
    expectsResponse: true,
    description: "Get queue status",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_HOSTING],
  },
  toggleailearning: {
    name: "toggleailearning",
    opcode: 0x94,
    verified: true,
    expectsResponse: false,
    description: "Toggle AI learning (often official servers only)",
    argumentFormat: "0|1 (optional)",
    sources: [SOURCE_PHP, SOURCE_TS, SOURCE_HOSTING],
  },
};

export const UnsupportedCommands = {
  getWhitelist: {
    name: "getWhitelist",
    reason:
      "Evrima RCON has no getWhitelist opcode in current community/developer tables. Use Game.ini WhitelistIDs or serverdetails.bServerWhitelist.",
  },
} as const;

export function getCommandDefinition(name: string): CommandDefinition | undefined {
  return VerifiedCommands[name.toLowerCase()];
}

export function requireCommandDefinition(name: string): CommandDefinition {
  const definition = getCommandDefinition(name);
  if (!definition) {
    throw new RconUnsupportedCommandError(`RCON command is not verified: ${name}`, {
      command: name,
      reason: "unverified_command",
    });
  }
  return definition;
}

export function listVerifiedCommands(): CommandDefinition[] {
  return Object.values(VerifiedCommands);
}

export function toToggleArgument(enabled?: boolean): string {
  if (enabled === undefined) {
    return "";
  }
  return enabled ? "1" : "0";
}
