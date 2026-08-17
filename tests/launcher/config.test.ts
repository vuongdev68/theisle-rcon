import { mkdirSync, mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GameConfigStore } from "../../src/config/gameConfigStore.js";
import { isLocalRconHost } from "../../src/config/env.js";
import { SESSION_SECTION, STATE_SECTION, getConfigValue, updateIniValue } from "../../src/ini/ueIni.js";
import { parseChatLine } from "../../src/services/ChatMonitor.js";
import { nextFixedRestart } from "../../src/services/AutomationService.js";

describe("isLocalRconHost", () => {
  it("treats only loopback as a colocated game process", () => {
    expect(isLocalRconHost("127.0.0.1")).toBe(true);
    expect(isLocalRconHost("localhost")).toBe(true);
    expect(isLocalRconHost("::1")).toBe(true);
    expect(isLocalRconHost("51.79.187.73")).toBe(false);
    expect(isLocalRconHost("0.0.0.0")).toBe(false);
  });
});
describe("ueIni", () => {
  it("updates a scalar in the owning section and drops duplicates", () => {
    const lines = [
      `[${SESSION_SECTION}]`,
      "ServerName=Old",
      "ServerName=Older",
      `[${STATE_SECTION}]`,
      "AdminsSteamIDs=1",
    ];
    updateIniValue(lines, SESSION_SECTION, "ServerName", "Gateway PvE");
    expect(lines.filter((line) => line.startsWith("ServerName="))).toEqual(["ServerName=Gateway PvE"]);
    expect(getConfigValue(lines.join("\n"), "ServerName", SESSION_SECTION)).toBe("Gateway PvE");
  });
});

describe("GameConfigStore", () => {
  it("round-trips Game.ini lists into the sections the game reads", () => {
    const root = mkdtempSync(join(tmpdir(), "isle-ini-"));
    mkdirSync(join(root, "TheIsle", "Saved", "Config", "LinuxServer"), { recursive: true });
    const store = new GameConfigStore(root, root);
    const config = store.load();
    config.serverName = "Test Gateway";
    config.dayLength = "50";
    config.adminSteamIds = ["76561198000000001"];
    config.whitelistIds = ["76561198000000002"];
    config.vipIds = ["76561198000000003"];
    config.dinosaurs = config.dinosaurs.map((item) => ({ ...item, enabled: item.name === "Tyrannosaurus" }));
    config.disallowedAIClasses = config.disallowedAIClasses.map((item) => ({
      ...item,
      enabled: item.name === "Chicken",
    }));
    store.save(config);
    const game = readFileSync(store.gameIniPath(), "utf8");
    expect(game).toContain(`[${SESSION_SECTION}]`);
    expect(game).toContain("ServerName=Test Gateway");
    expect(game).toContain("ServerDayLengthMinutes=50");
    expect(game).toContain("AdminsSteamIDs=76561198000000001");
    expect(game).toContain("AllowedClasses=Tyrannosaurus");
    expect(game).toContain("DisallowedAIClasses=Chicken");
    const reloaded = store.load();
    expect(reloaded.serverName).toBe("Test Gateway");
    expect(reloaded.adminSteamIds).toContain("76561198000000001");
    expect(reloaded.dinosaurs.find((item) => item.name === "Tyrannosaurus")?.enabled).toBe(true);
    expect(reloaded.disallowedAIClasses.find((item) => item.name === "Chicken")?.enabled).toBe(true);
  });

  it("keeps auto-broadcast after save/load in the web settings file", () => {
    const root = mkdtempSync(join(tmpdir(), "isle-broadcast-"));
    mkdirSync(join(root, "TheIsle", "Saved", "Config", "LinuxServer"), { recursive: true });
    const store = new GameConfigStore(root, root);
    const config = store.load();
    config.autoBroadcastEnabled = true;
    config.autoBroadcastMessage = "Test Interval";
    config.autoBroadcastIntervalMinutes = 1;
    store.save(config);
    expect(readFileSync(store.settingsPath(), "utf8")).toContain("AutoBroadcastEnabled=true");
    expect(store.load().autoBroadcastEnabled).toBe(true);
    expect(store.load().autoBroadcastMessage).toBe("Test Interval");
    expect(store.load().autoBroadcastIntervalMinutes).toBe(1);
  });

  it("does not write Game.ini when SERVER_DIR is empty (remote RCON)", () => {
    const root = mkdtempSync(join(tmpdir(), "isle-remote-"));
    const store = new GameConfigStore("", root);
    expect(store.enabled).toBe(false);
    const config = store.load();
    config.serverName = "Should Not Touch VPS";
    config.autoBroadcastEnabled = true;
    config.autoBroadcastMessage = "Remote ok";
    store.save(config);
    expect(existsSync(join(root, "TheIsle"))).toBe(false);
    expect(readFileSync(store.settingsPath(), "utf8")).toContain("AutoBroadcastMessage=Remote ok");
    expect(store.load().autoBroadcastEnabled).toBe(true);
    expect(store.load().autoBroadcastMessage).toBe("Remote ok");
  });
});

describe("parseChatLine", () => {
  it("maps Spatial to Local", () => {
    const parsed = parseChatLine(
      "LogTheIsleChatData: [Spatial] [2026.01.01-00.00.00:000] Hunter [123]: hello there",
    );
    expect(parsed).toMatchObject({ channel: "Local", player: "Hunter", message: "hello there" });
  });
});

describe("nextFixedRestart", () => {
  it("picks the next HH:mm today or tomorrow", () => {
    const noon = Date.parse("2026-08-16T12:00:00");
    const next = nextFixedRestart(noon, "04:00,16:00");
    expect(new Date(next).getHours()).toBe(16);
    const evening = Date.parse("2026-08-16T20:00:00");
    const tomorrow = nextFixedRestart(evening, "04:00,16:00");
    expect(new Date(tomorrow).getHours()).toBe(4);
  });
});
