import type { ExecuteOptions, RconExecutor, RconResponse } from "../rcon/RconTypes.js";
import { RconUnsupportedCommandError } from "../rcon/RconErrors.js";
import { evrimaProtocol } from "../rcon/EvrimaRconProtocol.js";
import { requireCommandDefinition, toToggleArgument, UnsupportedCommands } from "./commandRegistry.js";

export class WhitelistCommands {
  constructor(private readonly client: RconExecutor) {}

  async addWhitelist(playerId: string | string[], options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("addwhitelist");
    const ids = Array.isArray(playerId) ? playerId : [playerId];
    return this.client.executeOpcode(definition.opcode, evrimaProtocol.joinArguments(ids), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async removeWhitelist(playerId: string | string[], options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("removewhitelist");
    const ids = Array.isArray(playerId) ? playerId : [playerId];
    return this.client.executeOpcode(definition.opcode, evrimaProtocol.joinArguments(ids), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async toggleWhitelist(enabled?: boolean, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("togglewhitelist");
    return this.client.executeOpcode(definition.opcode, toToggleArgument(enabled), {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async getWhitelist(): Promise<never> {
    throw new RconUnsupportedCommandError(UnsupportedCommands.getWhitelist.reason, {
      command: "getWhitelist",
      reason: "unsupported",
    });
  }
}
