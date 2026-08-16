import { describe, expect, it } from "vitest";
import type { Player } from "../../src/rcon/RconTypes.js";
import {
  buildPlaySnapshot,
  findPlayerBySteamId,
  normalizeSteamId,
  toPlayMarker,
} from "../../src/web/playerView.js";

function player(partial: Partial<Player> & Pick<Player, "id" | "name">): Player {
  return { extra: {}, raw: "raw-secret", ...partial };
}

describe("normalizeSteamId", () => {
  it("accepts 17-digit SteamIDs", () => {
    expect(normalizeSteamId(" 76561198000000001 ")).toBe("76561198000000001");
  });

  it("rejects empty, short, or non-numeric values", () => {
    expect(normalizeSteamId("")).toBeUndefined();
    expect(normalizeSteamId("abc")).toBeUndefined();
    expect(normalizeSteamId("12345")).toBeUndefined();
    expect(normalizeSteamId(76561198000000001)).toBeUndefined();
  });
});

describe("buildPlaySnapshot", () => {
  const hunter = player({
    id: "76561198000000001",
    steamId: "76561198000000001",
    eosId: "eos-secret",
    name: "Hunter",
    playable: "Tyrannosaurus",
    growth: 0.75,
    health: 1,
    hunger: 0.4,
    thirst: 0.3,
    stamina: 0.5,
    location: { x: -123000, y: 45000, z: 200 },
    extra: { Class: "BP_Tyrannosaurus_C" },
  });
  const prey = player({
    id: "76561198000000002",
    steamId: "76561198000000002",
    name: "Prey",
    playable: "Dryosaurus",
    health: 0.2,
    location: { x: 10000, y: -20000, z: 0 },
  });

  it("exposes full vitals only for the looked-up SteamID", () => {
    const snapshot = buildPlaySnapshot(
      {
        players: [hunter, prey],
        details: { name: "Gateway PvE", map: "Gateway", maxPlayers: 100, extra: {}, raw: "" },
        connected: true,
      },
      "76561198000000001",
    );
    expect(snapshot.me).toMatchObject({
      steamId: "76561198000000001",
      name: "Hunter",
      health: 1,
      hunger: 0.4,
      thirst: 0.3,
    });
    expect(snapshot.markers).toHaveLength(2);
    expect(snapshot.markers.find((marker) => marker.me)?.name).toBe("Hunter");
    expect(JSON.stringify(snapshot)).not.toContain("eos-secret");
    expect(JSON.stringify(snapshot)).not.toContain("raw-secret");
    expect(snapshot.markers.some((marker) => "steamId" in marker)).toBe(false);
    expect(snapshot.markers.find((marker) => marker.name === "Prey")).toMatchObject({
      name: "Prey",
      playable: "Dryosaurus",
      me: false,
    });
    expect(snapshot.markers.find((marker) => marker.name === "Prey")).not.toHaveProperty("health");
  });

  it("returns null me when the SteamID is offline", () => {
    const snapshot = buildPlaySnapshot(
      { players: [prey], details: undefined, connected: true },
      "76561198000000001",
    );
    expect(snapshot.me).toBeNull();
    expect(snapshot.inventory.supported).toBe(false);
    expect(snapshot.inventory.stomach).toBeUndefined();
  });
});

describe("toPlayMarker", () => {
  it("omits identifiers besides the in-game name", () => {
    const marker = toPlayMarker(
      player({
        id: "76561198000000001",
        steamId: "76561198000000001",
        eosId: "eos",
        name: "Alpha",
        location: { x: 1, y: 2, z: 3 },
      }),
      true,
    );
    expect(marker).toEqual({
      name: "Alpha",
      playable: undefined,
      x: 1,
      y: 2,
      me: true,
    });
  });
});

describe("findPlayerBySteamId", () => {
  it("matches steamId or id", () => {
    const listed = [player({ id: "76561198000000001", steamId: "76561198000000001", name: "A" })];
    expect(findPlayerBySteamId(listed, "76561198000000001")?.name).toBe("A");
    expect(findPlayerBySteamId(listed, "nope")).toBeUndefined();
  });
});
