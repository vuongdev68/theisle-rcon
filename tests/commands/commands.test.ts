import { describe, expect, it } from "vitest";
import { formatPlayableUpdate } from "../../src/commands/PlayableCommands.js";
import { filterKnownAIClasses, KnownAIClasses } from "../../src/commands/aiClasses.js";
import { getCommandDefinition, UnsupportedCommands } from "../../src/commands/commandRegistry.js";
import { PlayerCommands } from "../../src/commands/PlayerCommands.js";
import { WhitelistCommands } from "../../src/commands/WhitelistCommands.js";
import { RconUnsupportedCommandError } from "../../src/rcon/RconErrors.js";

describe("verified commands", () => {
  it("maps playerlist to opcode 0x40", () => {
    expect(getCommandDefinition("playerlist")?.opcode).toBe(0x40);
    expect(getCommandDefinition("playerlist")?.verified).toBe(true);
  });

  it("maps getplayables to opcode 0x14", () => {
    expect(getCommandDefinition("getplayables")?.opcode).toBe(0x14);
  });

  it("does not invent getWhitelist", () => {
    expect(getCommandDefinition("getwhitelist")).toBeUndefined();
    expect(UnsupportedCommands.getWhitelist.name).toBe("getWhitelist");
  });

  it("does not invent slay/kill", () => {
    expect(getCommandDefinition("slay")).toBeUndefined();
    expect(getCommandDefinition("kill")).toBeUndefined();
  });
});

describe("known AI classes", () => {
  it("lists wildlife classes used by the launcher and developer Game.ini", () => {
    expect(KnownAIClasses.map((item) => item.name)).toEqual([
      "Compsognathus",
      "Pterodactylus",
      "Psittacosaurus",
      "Boar",
      "Deer",
      "Goat",
      "Rabbit",
      "Chicken",
      "Seaturtle",
      "SeaTurtle",
      "Bullfrog",
      "Crab",
    ]);
  });

  it("drops invalid class names", () => {
    expect(filterKnownAIClasses(["Deer", "Tyrannosaurus!", "Goat"])).toEqual(["Deer", "Goat"]);
  });
});

describe("updateplayables formatting", () => {
  it("joins class names with commas", () => {
    expect(formatPlayableUpdate(["Tyrannosaurus", "Triceratops", "Stegosaurus"])).toBe(
      "Tyrannosaurus,Triceratops,Stegosaurus",
    );
  });

  it("formats enabled/disabled pairs", () => {
    expect(
      formatPlayableUpdate([
        { className: "Tyrannosaurus", enabled: true },
        { className: "Dryosaurus", enabled: false },
      ]),
    ).toBe("Tyrannosaurus:enabled,Dryosaurus:disabled");
  });
});

describe("slay via custom 0x70", () => {
  it("sends slay <SteamID64> with a space, not a comma", async () => {
    let opcode = 0;
    let args = "";
    const commands = new PlayerCommands({
      execute: async () => ({ requestId: 1, type: 3, body: "" }),
      executeOpcode: async (code, payload) => {
        opcode = code;
        args = payload ?? "";
        return { requestId: 1, type: 3, body: "True" };
      },
    });
    await commands.slayPlayer("76561198241449436");
    expect(opcode).toBe(0x70);
    expect(args).toBe("slay 76561198241449436");
  });
});

describe("whitelist getWhitelist", () => {
  it("throws unsupported", async () => {
    const commands = new WhitelistCommands({
      execute: async () => ({ requestId: 1, type: 3, body: "" }),
      executeOpcode: async () => ({ requestId: 1, type: 3, body: "" }),
    });
    await expect(commands.getWhitelist()).rejects.toBeInstanceOf(RconUnsupportedCommandError);
  });
});
