import type { ExecuteOptions, Player, RconExecutor, RconResponse } from "../rcon/RconTypes.js";
import type { BanPlayerOptions, DirectMessageOptions, KickPlayerOptions } from "../rcon/RconTypes.js";
import { evrimaProtocol } from "../rcon/EvrimaRconProtocol.js";
import { parsePlayerDataResponse, parsePlayerListResponse } from "../rcon/responseParsers.js";
import { requireCommandDefinition } from "./commandRegistry.js";

export class PlayerCommands {
  constructor(private readonly client: RconExecutor) {}

  async playerList(options?: ExecuteOptions): Promise<Player[]> {
    const definition = requireCommandDefinition("playerlist");
    const response = await this.client.executeOpcode(definition.opcode, "", {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: false,
    });
    return parsePlayerListResponse(response.body);
  }

  async getPlayerData(playerId?: string, options?: ExecuteOptions): Promise<Player[]> {
    const definition = requireCommandDefinition("getplayerdata");
    const args = playerId ?? "";
    const response = await this.client.executeOpcode(definition.opcode, args, {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: false,
    });
    return parsePlayerDataResponse(response.body);
  }

  async kickPlayer(input: KickPlayerOptions, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("kick");
    const args = evrimaProtocol.joinArguments([input.playerId, input.reason]);
    return this.client.executeOpcode(definition.opcode, args, {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async banPlayer(input: BanPlayerOptions, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("ban");
    const args = input.name
      ? evrimaProtocol.joinArguments([
          input.name,
          input.playerId,
          input.reason,
          input.durationSeconds ?? 0,
        ])
      : evrimaProtocol.joinArguments([input.playerId, input.reason]);
    return this.client.executeOpcode(definition.opcode, args, {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }

  async directMessage(input: DirectMessageOptions, options?: ExecuteOptions): Promise<RconResponse> {
    const definition = requireCommandDefinition("directmessage");
    const args = evrimaProtocol.joinArguments([input.playerId, input.message]);
    return this.client.executeOpcode(definition.opcode, args, {
      ...options,
      commandName: definition.name,
      allowEmptyResponse: true,
    });
  }
}
