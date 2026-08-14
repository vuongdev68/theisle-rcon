import { describe, expect, it } from "vitest";
import {
  parsePlayablesResponse,
  parsePlayerDataResponse,
  parsePlayerListResponse,
  parseQueueStatusResponse,
  parseServerDetailsResponse,
} from "../../src/rcon/responseParsers.js";

describe("parsePlayerListResponse", () => {
  it("parses grouped SteamId/Name/EOSId lines", () => {
    const body = [
      "PlayerList",
      "76561198000000001,76561198000000002,",
      "Alpha,Bravo,",
      "eos-one,eos-two,",
    ].join("\n");
    const players = parsePlayerListResponse(body);
    expect(players).toHaveLength(2);
    expect(players[0]).toMatchObject({
      id: "76561198000000001",
      name: "Alpha",
      steamId: "76561198000000001",
      eosId: "eos-one",
    });
    expect(players[1]?.name).toBe("Bravo");
  });

  it("parses interleaved id,name,eos triplets", () => {
    const body = "[2026.01.01-00.00.00:000] PlayerList76561198000000001,Alpha,eos-one,76561198000000002,Bravo,eos-two";
    const players = parsePlayerListResponse(body);
    expect(players).toHaveLength(2);
    expect(players[0]?.name).toBe("Alpha");
    expect(players[1]?.id).toBe("76561198000000002");
  });

  it("returns an empty list for empty bodies", () => {
    expect(parsePlayerListResponse("PlayerList")).toEqual([]);
  });
});

describe("parsePlayerDataResponse", () => {
  it("parses Name/PlayerID/Location/Class/Growth fields", () => {
    const line =
      "Name: Hunter, PlayerID: 76561198000000001, Location: X=1.5 Y=2.25 Z=10, Class: BP_Tyrannosaurus_C, Growth: 0.75, Health: 1, Stamina: 0.5, Hunger: 0.4, Thirst: 0.3";
    const [player] = parsePlayerDataResponse(`PlayerData\n${line}\nPlayerDataEnd`);
    expect(player?.name).toBe("Hunter");
    expect(player?.id).toBe("76561198000000001");
    expect(player?.playable).toBe("Tyrannosaurus");
    expect(player?.growth).toBe(0.75);
    expect(player?.location).toEqual({ x: 1.5, y: 2.25, z: 10 });
    expect(player?.extra.Class).toBe("BP_Tyrannosaurus_C");
  });
});

describe("parseServerDetailsResponse", () => {
  it("maps known keys and keeps unknown fields in extra", () => {
    const body =
      "ServerDetails ServerName: Gateway PvE, ServerMap: Gateway, ServerMaxPlayers: 100, ServerCurrentPlayers: 12, bSpawnAI: true, CustomFlag: experimental";
    const details = parseServerDetailsResponse(body);
    expect(details.name).toBe("Gateway PvE");
    expect(details.map).toBe("Gateway");
    expect(details.maxPlayers).toBe(100);
    expect(details.currentPlayers).toBe(12);
    expect(details.spawnAI).toBe(true);
    expect(details.extra.CustomFlag).toBe("experimental");
    expect(details.raw).toContain("CustomFlag");
  });

  it("redacts ServerPassword instead of dropping it silently", () => {
    const details = parseServerDetailsResponse("ServerDetails ServerName: Test, ServerPassword: super-secret");
    expect(details.extra.ServerPassword).toBe("[redacted]");
    expect(details.raw).toContain("ServerPassword");
  });
});

describe("parsePlayablesResponse", () => {
  it("parses comma-separated class names", () => {
    const playables = parsePlayablesResponse("Tyrannosaurus,Triceratops,Stegosaurus");
    expect(playables.map((item) => item.name)).toEqual(["Tyrannosaurus", "Triceratops", "Stegosaurus"]);
  });

  it("parses class:enabled pairs", () => {
    const playables = parsePlayablesResponse("Tyrannosaurus:enabled,Dryosaurus:disabled");
    expect(playables[0]?.enabled).toBe(true);
    expect(playables[1]?.enabled).toBe(false);
  });
});

describe("parseQueueStatusResponse", () => {
  it("keeps unknown queue fields", () => {
    const status = parseQueueStatusResponse("QueueCount: 3, QueueEnabled: true");
    expect(status.extra.QueueCount).toBe("3");
    expect(status.extra.QueueEnabled).toBe("true");
  });
});
