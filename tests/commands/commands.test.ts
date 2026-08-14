import { describe, expect, it } from "vitest";
import { formatPlayableUpdate } from "../../src/commands/PlayableCommands.js";
import { getCommandDefinition, UnsupportedCommands } from "../../src/commands/commandRegistry.js";
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

describe("whitelist getWhitelist", () => {
  it("throws unsupported", async () => {
    const commands = new WhitelistCommands({
      execute: async () => ({ requestId: 1, type: 3, body: "" }),
      executeOpcode: async () => ({ requestId: 1, type: 3, body: "" }),
    });
    await expect(commands.getWhitelist()).rejects.toBeInstanceOf(RconUnsupportedCommandError);
  });
});
